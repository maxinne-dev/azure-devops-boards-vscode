import { WorkItem } from 'azure-devops-node-api/interfaces/WorkItemTrackingInterfaces';
import * as vscode from 'vscode';

export enum WorkItemLinksParentType {
  GitHub = 'GitHub',
  AzureDevOps = 'Azure DevOps',
}

export class WorkItemLinksParentTreeItem extends vscode.TreeItem {
  public readonly prLinks: string[] = [];

  constructor(
    public readonly workItem: WorkItem,
    public readonly type: WorkItemLinksParentType,
  ) {
    super(`${type} Pull Request`, vscode.TreeItemCollapsibleState.Collapsed);

    const relations = workItem.relations || [];

    this.prLinks = relations.reduce<string[]>((prev, { rel, url }) => {
      if (
        rel === 'ArtifactLink' &&
        type === WorkItemLinksParentType.GitHub &&
        url?.startsWith('vstfs:///GitHub/PullRequest')
      ) {
        prev.push(url);
      }
      return prev;
    }, []);

    if (this.type === WorkItemLinksParentType.GitHub) {
      this.iconPath = new vscode.ThemeIcon('github-alt');
    }
  }
}
