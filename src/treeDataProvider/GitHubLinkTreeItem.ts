import { WorkItem } from 'azure-devops-node-api/interfaces/WorkItemTrackingInterfaces';
import * as vscode from 'vscode';
import { GitHubPullRequest } from '../interfaces';

export class GitHubLinkTreeItem extends vscode.TreeItem {
  constructor(
    public readonly workItem: WorkItem,
    public readonly gitHubPullRequest: GitHubPullRequest,
  ) {
    const label = `#${gitHubPullRequest.numberOrSHA} - ${gitHubPullRequest.title}`;
    super(label, vscode.TreeItemCollapsibleState.None);

    const { title, numberOrSHA, author, state, reviewDecision, url } = this.gitHubPullRequest;
    this.contextValue = 'githubPullRequest';
    this.description = author.displayName;
    this.tooltip = new vscode.MarkdownString(
      `${state} | ${reviewDecision} (${author.displayName})  \n#${numberOrSHA} - ${title}  \n${url}`,
    );
    this.iconPath = (function () {
      if (state === 'Open') {
        return reviewDecision === 'Approved' ? new vscode.ThemeIcon('pass') : new vscode.ThemeIcon('git-pull-request');
      } else if (state === 'Merged') {
        return new vscode.ThemeIcon('git-merge');
      } else if (state === 'Closed') {
        return new vscode.ThemeIcon('git-pull-request-closed');
      }
    })();
  }
}
