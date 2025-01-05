import { WebApiTeam } from 'azure-devops-node-api/interfaces/CoreInterfaces';
import { TeamSettingsIteration } from 'azure-devops-node-api/interfaces/WorkInterfaces';
import * as vscode from 'vscode';
import { GLOBAL_STATE } from './constants';
import * as adoClient from './services/adoService';
import { updatePrBody } from './services/githubService';
import { BoardTreeItem, BoardTreeDataProvider } from './treeDataProvider/BoardTreeDataProvider';
import { GitHubLinkTreeItem } from './treeDataProvider/GitHubLinkTreeItem';
import { WorkItemTreeItem } from './treeDataProvider/WorkItemTreeItem';
import { getWorkItemPreviewHtml, callWebHook, getSettings, openExternalUrl } from './utils';

type QuickPickItem<T> = vscode.QuickPickItem & { id: string; _rawValue: T };

const webviewPanels: Record<number, vscode.WebviewPanel> = {};

export const registerCommands = ({
  context,
  treeDataProvider,
  treeView,
}: {
  context: vscode.ExtensionContext;
  treeDataProvider: BoardTreeDataProvider;
  treeView: vscode.TreeView<BoardTreeItem>;
}): vscode.Disposable[] => [
  vscode.commands.registerCommand('adoBoards.refreshTree', async () => {
    const { projectId } = getSettings();
    const selectedTeam = context.globalState.get<WebApiTeam>(GLOBAL_STATE.SELECTED_TEAM);
    const selectedIteration = context.globalState.get<TeamSettingsIteration>(GLOBAL_STATE.SELECTED_ITERATION);
    const teamContext = { projectId, teamId: selectedTeam?.id };

    const iterationAsync =
      selectedIteration ||
      (async function () {
        // undefined
        const [currentIteration] = await adoClient.getIterations(teamContext, true);
        context.globalState.update(GLOBAL_STATE.SELECTED_ITERATION, currentIteration);
        return currentIteration;
      })();

    treeDataProvider.refresh({
      teamContext,
      iterationIdAsync: Promise.resolve((await iterationAsync)?.id),
    });

    const iterationName = (await iterationAsync)?.name;
    const teamName = selectedTeam?.name;

    treeView.title = `${iterationName ? `${iterationName} - ` : ''}${teamName || ''}`;
  }),

  vscode.commands.registerCommand('adoBoards.selectTeam', async () => {
    const quickPick = vscode.window.createQuickPick<QuickPickItem<WebApiTeam>>();
    quickPick.placeholder = 'Please select your team';
    quickPick.show();

    quickPick.busy = true;
    const adoTeams = await adoClient.getTeams();
    quickPick.busy = false;

    quickPick.items = adoTeams.reduce<QuickPickItem<WebApiTeam>[]>(
      (prev, team) => (team.id && team.name ? [...prev, { label: team.name, id: team.id, _rawValue: team }] : prev),
      [],
    );

    quickPick.onDidChangeSelection(([{ id: selectedId }]) => {
      quickPick.hide();

      const currentSelectedTeam = context.globalState.get<WebApiTeam>(GLOBAL_STATE.SELECTED_TEAM);

      if (selectedId !== currentSelectedTeam?.id) {
        context.globalState.update(
          GLOBAL_STATE.SELECTED_TEAM,
          adoTeams.find(({ id }) => id === selectedId),
        );
        context.globalState.update(GLOBAL_STATE.SELECTED_ITERATION, undefined);
      }

      vscode.commands.executeCommand('adoBoards.refreshTree');
    });
  }),

  vscode.commands.registerCommand('adoBoards.selectIteration', async () => {
    const { projectId } = getSettings();
    const quickPick = vscode.window.createQuickPick<QuickPickItem<WebApiTeam>>();
    quickPick.placeholder = 'Please select your iteration';
    quickPick.show();

    quickPick.busy = true;
    const selectedTeam = context.globalState.get<WebApiTeam>(GLOBAL_STATE.SELECTED_TEAM);
    const teamContext = { projectId, teamId: selectedTeam?.id };
    const iterations = await adoClient.getIterations(teamContext);
    quickPick.busy = false;

    quickPick.items = iterations.reduce<QuickPickItem<TeamSettingsIteration>[]>(
      (prev, iteration) =>
        iteration.id && iteration.name
          ? [...prev, { label: iteration.name, id: iteration.id, _rawValue: iteration }]
          : prev,
      [],
    );

    quickPick.onDidChangeSelection(([{ id: selectedId }]) => {
      quickPick.hide();

      const currentSelectedIteration = context.globalState.get<TeamSettingsIteration>(GLOBAL_STATE.SELECTED_ITERATION);

      if (selectedId !== currentSelectedIteration?.id) {
        context.globalState.update(
          GLOBAL_STATE.SELECTED_ITERATION,
          iterations.find(({ id }) => id === selectedId),
        );
        vscode.commands.executeCommand('adoBoards.refreshTree');
      }
    });
  }),

  vscode.commands.registerCommand('adoBoards.preview', async (item?: WorkItemTreeItem) => {
    const id = item?.workItem?.id;
    if (id) {
      const workItem = (await adoClient.getWorkItems([id]))[0];

      if (id && webviewPanels[id]) {
        webviewPanels[id].reveal(vscode.ViewColumn.Active);
      } else if (id) {
        const panel = vscode.window.createWebviewPanel('taskDetails', `${id}`, vscode.ViewColumn.Active, {
          enableFindWidget: true,
          enableScripts: true,
        });
        panel.webview.html = await getWorkItemPreviewHtml(workItem);
        panel.onDidDispose(() => delete webviewPanels[id], null, context.subscriptions);
        webviewPanels[id] = panel;
      }
    } else {
      console.error('empty workItem');
    }
  }),

  vscode.commands.registerCommand('adoBoards.openInBrowser', async (item?: BoardTreeItem) => {
    let url: string = '';

    if (item instanceof GitHubLinkTreeItem) {
      url = item.gitHubPullRequest.url;
    } else if (item instanceof WorkItemTreeItem) {
      url = item.workItem?._links.html?.href;
    }

    openExternalUrl(url);
  }),

  vscode.commands.registerCommand('adoBoards.updateItemState', async (item?: WorkItemTreeItem) => {
    const selectedItem = await vscode.window.showQuickPick(
      treeDataProvider._workItemTypeStateColors
        .find(({ workItemTypeName }) => workItemTypeName === item?.workItem?.fields?.['System.WorkItemType'])
        ?.stateColors?.map(
          ({ name }) =>
            ({
              label: name!,
              // picked: name === item?.workItem?.fields?.['System.State'],
            }) satisfies vscode.QuickPickItem,
        ) || [],
      { placeHolder: 'Select a new state' },
    );

    if (!selectedItem || !item?.workItem?.id) {
      return;
    }

    try {
      const updatedItem = await adoClient.updateWorkItemState(item.workItem.id, selectedItem.label);
      treeDataProvider.refresh();

      // workItemStateChange webhook
      const { url, watchStates } = getSettings().webHook.workItemStateChange || {};
      const successMessage = `Work item ${item.workItem.id} state updated to ${updatedItem.fields?.['System.State']}.`;

      if (url && Array.isArray(watchStates) && watchStates.includes(selectedItem.label)) {
        const payload = {
          attachments: [
            { contentType: 'object', content: { title: item?.label, url: item.workItem?._links.html?.href } },
          ],
        };
        await callWebHook(`${successMessage} Trigger webhook?`, url, payload);
      } else {
        vscode.window.showInformationMessage(successMessage);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to update work item state. ${error}`);
      console.error('Error:', error);
    }
  }),

  vscode.commands.registerCommand('adoBoards.assignTo', async (item?: WorkItemTreeItem) => {
    const workItemId = item?.workItem?.id;
    const currentUser = await adoClient.getCurrentUser();
    // @ts-ignore
    const currentUserDisplayName = currentUser.displayName;

    const selectedItem = await vscode.window.showQuickPick(
      [
        { label: currentUserDisplayName, description: 'Me' },
        { label: 'Unassign' },
        { label: 'Separator', kind: vscode.QuickPickItemKind.Separator },
      ] satisfies vscode.QuickPickItem[],
      { placeHolder: 'Select a user' },
    );

    if (!selectedItem || !workItemId) {
      return;
    }

    try {
      const newValue = selectedItem.label === 'Unassign' ? '' : selectedItem.label;
      await adoClient.assignUserToWorkItem(newValue, workItemId);
      vscode.window.showInformationMessage(
        newValue ? `Work item ${workItemId} assigned to ${selectedItem.label}.` : `Work item ${workItemId} unassigned.`,
      );
      treeDataProvider.refresh();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to assign user to work item. ${error}`);
      console.error('Error:', error);
    }
  }),

  vscode.commands.registerCommand('adoBoards.createInitialTasks', async (item?: WorkItemTreeItem) => {
    const { defaultInitialTasks } = getSettings();

    if (!item?.workItem?.id || !defaultInitialTasks.length) {
      vscode.window.showErrorMessage('Please configure default initial tasks in settings.');
      return;
    }

    const parentId = item.workItem.id;

    const confirm = await vscode.window.showWarningMessage(
      `${defaultInitialTasks.join(', ')} will be created under the selected work item ${parentId}. Do you want to proceed?`,
      'Yes',
      'No',
    );

    if (confirm !== 'Yes') {
      return;
    }

    try {
      const newTasks = await Promise.all(defaultInitialTasks.map((title) => adoClient.createSubtask(parentId, title)));

      vscode.window.showInformationMessage(
        `Subtasks ${newTasks.map((t) => t.id).join(', ')} created successfully under ${parentId}.`,
      );
      treeDataProvider.refresh();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to create task. ${error}`);
      console.error('Error:', error);
    }
  }),

  vscode.commands.registerCommand('adoBoards.createSubtask', async (item?: WorkItemTreeItem) => {
    if (!item?.workItem?.id) {
      return;
    }

    const input = await vscode.window.showInputBox({
      placeHolder: 'Enter your task title here',
      validateInput: (value) => (value.trim() === '' ? 'Task title is required.' : null),
    });

    if (!input?.trim()) {
      return;
    }

    try {
      const task = await adoClient.createSubtask(item.workItem.id, input);
      vscode.window.showInformationMessage(`Subtask ${task.id} created successfully under ${item.workItem.id}.`);
      treeDataProvider.refresh();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to create task. ${error}`);
      console.error('Error:', error);
    }
  }),

  vscode.commands.registerCommand('adoBoards.deleteSubtask', async (item?: WorkItemTreeItem) => {
    if (!item?.workItem?.id) {
      return;
    }

    const id = item.workItem.id;

    const confirm = await vscode.window.showWarningMessage(
      `Work item ${id} will be deleted. Do you want to proceed?`,
      'Yes',
      'No',
    );

    if (confirm !== 'Yes') {
      return;
    }

    try {
      await adoClient.deleteWorkItem(id);
      vscode.window.showInformationMessage(`Work item ${id} deleted successfully.`);
      treeDataProvider.refresh();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to delete task. ${error}`);
      console.error('Error:', error);
    }
  }),

  vscode.commands.registerCommand('adoBoards.pullRequest.openInGithubDev', async (item?: GitHubLinkTreeItem) => {
    let url = item?.gitHubPullRequest?.url;

    if (url) {
      openExternalUrl(url.replace('github.com', 'github.dev'));
    }
  }),

  vscode.commands.registerCommand('adoBoards.pullRequest.openInCurrentWorkspace', async (item?: GitHubLinkTreeItem) => {
    let url = item?.gitHubPullRequest?.url;

    if (url) {
      vscode.commands.executeCommand('remoteHub.openRepository', url);
    } else {
      console.error('empty url');
    }
  }),

  vscode.commands.registerCommand('adoBoards.pullRequest.readyForReview', async (item?: GitHubLinkTreeItem) => {
    const url = item?.gitHubPullRequest?.url;

    if (url) {
      await updatePrBody(url);
      // TODO add reviewers

      const successMessage = 'Pull request body updated.';
      const webHook = getSettings().webHook.pullRequestReadyForReview;
      if (webHook) {
        const payload = { attachments: [{ contentType: 'object', content: { title: item?.label, url } }] };
        await callWebHook(`${successMessage} Trigger webhook?`, webHook, payload);
      } else if (successMessage) {
        vscode.window.showInformationMessage(successMessage);
      }
    }
  }),
];
