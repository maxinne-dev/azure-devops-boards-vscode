export interface GitHubPullRequest {
  author: { avatarUrl: string; displayName: string };
  title: string;
  url: string;
  reviewDecision: 'Approved' | 'ReviewRequired';
  state: 'Open' | 'Merged' | 'Closed';
  numberOrSHA: string;
  // isDraft: boolean;

  // checkResults
  // closedAt
  // commitStatuses
  // connectionAuthenticationType
  // createdAt
  // date
  // errorMessage: string | null;

  // itemType: 'pullRequest';
  // mergedAt: string | null;

  // providerKey: string;
  // repoInternalId: string;
  // repoNameWithOwner: string;
  // target: string;
}
