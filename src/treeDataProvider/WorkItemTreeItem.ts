import { WorkItem } from 'azure-devops-node-api/interfaces/WorkItemTrackingInterfaces';
import * as vscode from 'vscode';
import { getItemStateIcon } from '../utils';

export class WorkItemTreeItem extends vscode.TreeItem {
  constructor(
    public readonly workItem: WorkItem,
    public readonly stateIconColor: string,
    public readonly workItemCollapsibleState?: vscode.TreeItemCollapsibleState,
  ) {
    const label = `${workItem.id} - ${workItem.fields?.['System.Title']}`;
    super(label, workItemCollapsibleState ?? vscode.TreeItemCollapsibleState.Collapsed);

    const assignedTo: string = workItem?.fields?.['System.AssignedTo']?.displayName || '';
    const workItemState: string = workItem?.fields?.['System.State'] || '';

    this.description = assignedTo;
    this.tooltip = new vscode.MarkdownString(
      `${workItemState}${assignedTo ? ` - ${assignedTo}` : ''}  \n${this.workItem?.id} - ${this.workItem?.fields?.['System.Title']}`,
    );

    if (stateIconColor) {
      this.iconPath = getItemStateIcon(stateIconColor);
    }
  }
}
