import * as azdev from 'azure-devops-node-api';
import { CoreApi } from 'azure-devops-node-api/CoreApi';
import { TeamContext } from 'azure-devops-node-api/interfaces/CoreInterfaces';
import { TimeFrame } from 'azure-devops-node-api/interfaces/WorkInterfaces';
import { WorkItemExpand, CommentExpandOptions } from 'azure-devops-node-api/interfaces/WorkItemTrackingInterfaces';
import { ProfileApi } from 'azure-devops-node-api/ProfileApi';
import { WorkApi } from 'azure-devops-node-api/WorkApi';
import { WorkItemTrackingApi } from 'azure-devops-node-api/WorkItemTrackingApi';
import type { TreeItemData } from '../treeDataProvider/BoardTreeDataProvider';
import { getSettings } from '../utils';

interface AdoApi {
  workApi: WorkApi;
  coreApi: CoreApi;
  workItemTrackingApi: WorkItemTrackingApi;
  profileApi?: ProfileApi;
}

let _apiPromise: Promise<AdoApi> | null = null;

const getApis = async () => {
  if (!_apiPromise) {
    _apiPromise = _getApis();
  }
  return _apiPromise;
};

const _getApis: () => Promise<AdoApi> = async () => {
  console.log('Creating ADO connection...');

  const { adoPersonalAccessToken, serverUrl } = getSettings();
  const authHandler = azdev.getPersonalAccessTokenHandler(adoPersonalAccessToken);
  const connection = new azdev.WebApi(serverUrl, authHandler);
  const workApi = await connection.getWorkApi();
  const coreApi = await connection.getCoreApi();
  const workItemTrackingApi = await connection.getWorkItemTrackingApi();

  // profileApi only available in Visual Studio Shared Platform Services (vssps).
  let profileApi;
  if (serverUrl.startsWith('https://dev.azure.com')) {
    const vsspsServerUrl = serverUrl.replace('https://dev.azure.com', 'https://vssps.dev.azure.com');
    const vsspsConnection = new azdev.WebApi(vsspsServerUrl, authHandler);
    profileApi = await vsspsConnection.getProfileApi();
  } else {
    try {
      profileApi = await connection.getProfileApi();
    } catch (error) {
      console.error('Error getting profile api', error);
    }
  }

  return { workApi, coreApi, workItemTrackingApi, profileApi };
};

export const getTeams = async (mine = false) => {
  const { projectId } = getSettings();
  const { coreApi } = await getApis();
  return coreApi.getTeams(projectId, mine);
};

export const getIterations = async (teamContext: TeamContext, current = false) => {
  const { workApi } = await getApis();
  const iterations = (await workApi.getTeamIterations(teamContext)) || [];
  if (current) {
    const currentIteration = iterations.filter((i) => i.attributes?.timeFrame === TimeFrame.Current);
    return currentIteration.length ? currentIteration : iterations;
  }
  return iterations.reverse();
};

export const getWorkItemTypeStateColors = async () => {
  const { projectId } = getSettings();
  const { workItemTrackingApi } = await getApis();
  const [{ workItemTypeStateColors = [] }] = await workItemTrackingApi.getWorkItemStateColors([projectId]);
  return workItemTypeStateColors;
};

export const getTaskBoardColumns = async (teamContext: TeamContext) => {
  const { workApi } = await getApis();
  const { columns = [] } = await workApi.getColumns(teamContext);
  return columns;
};

export const getTreeWorkItems = async (teamContext: TeamContext, iterationId: string): Promise<TreeItemData[]> => {
  const { workApi, workItemTrackingApi } = await getApis();

  const workItemRelations = (await workApi.getIterationWorkItems(teamContext, iterationId)).workItemRelations || [];
  const ids = workItemRelations.map((w) => w.target?.id).filter((id) => typeof id !== 'undefined');
  const workItems = await workItemTrackingApi.getWorkItems(ids, undefined, undefined, WorkItemExpand.All);

  const findItem = (id: number) => {
    const workItem = workItems.find((w) => w.id === id);
    if (!workItem) {
      console.warn(`Work item ${id} not found`);
    }
    return workItem;
  };

  const findChildren = (parentId: number): TreeItemData[] | undefined => {
    return workItemRelations.reduce<TreeItemData[]>((prev, { source, target }) => {
      const id = target?.id;
      const item = id && findItem(id);
      return source?.id === parentId && item ? [...prev, { id, item }] : prev;
    }, []);
  };

  return workItemRelations.reduce<TreeItemData[]>((prev, { rel, target }) => {
    const id = target?.id;
    const item = id && findItem(id);
    return rel === null && item ? [...prev, { id, item, children: findChildren(id) }] : prev;
  }, []);
};

export const updateWorkItemState = async (id: number, state: string) => {
  const { workItemTrackingApi } = await getApis();
  const patchDocument = [{ op: 'add', path: '/fields/System.State', value: state }];
  return workItemTrackingApi.updateWorkItem(undefined, patchDocument, id);
};

export const createSubtask = async (parentId: number, title: string) => {
  const { serverUrl, projectId } = getSettings();
  const { workItemTrackingApi } = await getApis();

  const parent = await workItemTrackingApi.getWorkItem(parentId);
  const areaPath = parent.fields?.['System.AreaPath'];
  const iterationPath = parent.fields?.['System.IterationPath'];

  const payLoad = [
    { op: 'add', path: '/fields/System.Title', value: title },
    { op: 'add', path: '/fields/System.AreaPath', value: areaPath },
    { op: 'add', path: '/fields/System.IterationPath', value: iterationPath },
    {
      op: 'add',
      path: '/relations/-',
      value: {
        rel: 'System.LinkTypes.Hierarchy-Reverse',
        url: `${serverUrl}/${projectId}/_workitems/edit/${parentId}`,
      },
    },
  ];

  return workItemTrackingApi.createWorkItem(undefined, payLoad, projectId, 'Task');
};

export const deleteWorkItem = async (id: number) => {
  const { workItemTrackingApi } = await getApis();
  return workItemTrackingApi.deleteWorkItem(id);
};

export const getWorkItems = async (ids: number[]) => {
  const { workItemTrackingApi } = await getApis();
  return workItemTrackingApi.getWorkItems(ids);
};

export const getWorkItemComments = async (id: number) => {
  const { projectId } = getSettings();
  const { workItemTrackingApi } = await getApis();
  return workItemTrackingApi.getComments(
    projectId,
    id,
    undefined,
    undefined,
    undefined,
    CommentExpandOptions.RenderedText,
  );
};

export const getCurrentUser = async () => {
  const { profileApi } = await getApis();
  if (!profileApi) {
    throw new Error('Profile API not available');
  }
  return profileApi.getProfile('me');
};

export const assignUserToWorkItem = async (userName: string, workItemId: number) => {
  const { workItemTrackingApi } = await getApis();
  const patchDocument = [
    {
      op: 'add',
      path: '/fields/System.AssignedTo',
      value: userName,
    },
  ];
  return workItemTrackingApi.updateWorkItem({}, patchDocument, workItemId);
};
