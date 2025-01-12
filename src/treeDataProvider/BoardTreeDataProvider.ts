import { TeamContext } from 'azure-devops-node-api/interfaces/CoreInterfaces';
import { TaskboardColumn } from 'azure-devops-node-api/interfaces/WorkInterfaces';
import { WorkItem, WorkItemTypeStateColors } from 'azure-devops-node-api/interfaces/WorkItemTrackingInterfaces';
import * as vscode from 'vscode';
import { STATE_ICON_COLOR_MAP } from '../constants';
import { getGitHubArtifact } from '../utils';
import { GitHubLinkTreeItem } from './GitHubLinkTreeItem';
import { WorkItemLinksParentType, WorkItemLinksParentTreeItem } from './WorkItemLinksParentTreeItem';
import { WorkItemTreeItem } from './WorkItemTreeItem';
import * as adoClient from '../services/adoService';

export type TreeItemData = {
  id: number;
  item: WorkItem;
  children?: TreeItemData[];
};

export type BoardTreeItem = WorkItemTreeItem | WorkItemLinksParentTreeItem | GitHubLinkTreeItem | vscode.TreeItem;

export class BoardTreeDataProvider implements vscode.TreeDataProvider<BoardTreeItem> {
  private _treeItemData: TreeItemData[] = [];
  private _taskBoardColumns: TaskboardColumn[] = [];
  private _taskBoardColumnsOrder: (string | undefined)[] = [];
  public _workItemTypeStateColors: WorkItemTypeStateColors[] = [];

  private _onDidChangeTreeData: vscode.EventEmitter<BoardTreeItem | undefined | void> = new vscode.EventEmitter<
    BoardTreeItem | undefined | void
  >();
  readonly onDidChangeTreeData: vscode.Event<BoardTreeItem | undefined | void> = this._onDidChangeTreeData.event;

  constructor(
    protected teamContext?: TeamContext,
    protected iterationIdAsync?: string | Promise<string | undefined>,
  ) {}

  private async initialize() {
    const iterationId = await this.iterationIdAsync;

    if (!this.teamContext || !iterationId) {
      this._treeItemData = [];
      return false;
    }

    const getTreeWorkItemsAsync = adoClient.getTreeWorkItems(this.teamContext, iterationId);

    if (!this._taskBoardColumns.length || !this._workItemTypeStateColors.length) {
      const [treeItemData, taskBoardColumns, workItemTypeStateColors] = await Promise.all([
        getTreeWorkItemsAsync,
        adoClient.getTaskBoardColumns(this.teamContext),
        adoClient.getWorkItemTypeStateColors(),
      ]);

      this._treeItemData = treeItemData;
      this._taskBoardColumns = taskBoardColumns;
      this._workItemTypeStateColors = workItemTypeStateColors;
      this._taskBoardColumnsOrder = this._taskBoardColumns
        .sort(({ order: orderA = 0 }, { order: orderB = 0 }) => orderA - orderB)
        .map(({ name }) => name);
    } else {
      this._treeItemData = await getTreeWorkItemsAsync;
    }

    return true;
  }

  async getChildren(treeItem?: BoardTreeItem | undefined): Promise<BoardTreeItem[] | undefined> {
    if (!this.teamContext && !this.iterationIdAsync) {
      return [];
    }

    // root
    if (!treeItem) {
      await this.initialize();
      return this._treeItemData.length
        ? this._treeItemData.map(({ item }) => {
            const boardItem = new WorkItemTreeItem(item, this.getItemStateIconColor(item));
            boardItem.contextValue = 'parentTaskItem';
            return boardItem;
          })
        : [new vscode.TreeItem('No items available', vscode.TreeItemCollapsibleState.None)];
    }

    // work item
    if (treeItem instanceof WorkItemTreeItem) {
      const children =
        this._treeItemData
          .find(({ id }) => id === treeItem.workItem.id)
          ?.children?.map(({ item }) => {
            const childTreeItem = new WorkItemTreeItem(
              item,
              this.getItemStateIconColor(item),
              vscode.TreeItemCollapsibleState.None,
            );
            childTreeItem.contextValue = 'childTaskItem';
            return childTreeItem;
          })
          .sort(
            (a, b) =>
              this._taskBoardColumnsOrder.indexOf(this.getColumnName(a.workItem)) -
              this._taskBoardColumnsOrder.indexOf(this.getColumnName(b.workItem)),
          ) || [];

      // prepend pr parent tree item
      const prParentItem = new WorkItemLinksParentTreeItem(treeItem.workItem, WorkItemLinksParentType.GitHub);
      return prParentItem.prLinks.length ? [prParentItem, ...children] : children;
    }

    // pull request
    if (
      treeItem instanceof WorkItemLinksParentTreeItem &&
      treeItem.type === WorkItemLinksParentType.GitHub &&
      treeItem.workItem.id
    ) {
      const prs = await getGitHubArtifact(treeItem.workItem.id, treeItem.prLinks);
      return prs?.map((pr) => new GitHubLinkTreeItem(treeItem.workItem, pr));
    }
  }

  getTreeItem(treeItem: BoardTreeItem): vscode.TreeItem {
    return treeItem;
  }

  refresh(params?: { teamContext: TeamContext; iterationIdAsync: string | Promise<string | undefined> }) {
    if (params) {
      const { teamContext, iterationIdAsync } = params;
      this.teamContext = teamContext;
      this.iterationIdAsync = iterationIdAsync;
    }

    this._onDidChangeTreeData.fire();
  }

  private getColumnName(item?: WorkItem): string | undefined {
    const itemType: string = item?.fields?.['System.WorkItemType'] || '';
    const itemState: string = item?.fields?.['System.State'] || '';
    return this._taskBoardColumns?.find(({ mappings }) =>
      mappings?.find(({ state, workItemType }) => workItemType === itemType && state === itemState),
    )?.name;
  }

  private getItemStateIconColor(workItem: WorkItem): string {
    const workItemType: string = workItem?.fields?.['System.WorkItemType'] || '';
    const workItemState: string = workItem?.fields?.['System.State'] || '';
    const customColor = STATE_ICON_COLOR_MAP[workItemState];
    const systemColor = this._workItemTypeStateColors
      .find(({ workItemTypeName }) => workItemTypeName === workItemType)
      ?.stateColors?.find(({ name }) => name === workItemState)?.color;
    return customColor || (systemColor ? `#${systemColor}` : '');
  }
}
