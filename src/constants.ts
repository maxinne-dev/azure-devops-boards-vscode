export enum GLOBAL_STATE {
  SELECTED_TEAM = 'selectedTeam',
  SELECTED_ITERATION = 'selectedIteration',
}

export const AB_PATTERN = /\[AB#(\d+)\]\(https:\/\/\S+\)(?!\s-.*)/g;

// TODO: move to settings
export const STATE_ICON_COLOR_MAP: Record<string, string> = {
  Ready: '#b2b2b2',
  New: '#b2b2b2',
  'In Progress': '#007acc',
  'In Development': '#007acc',
  'Peer Review': '#ffcc00',
  'Dev Complete': '#ff9800',
  'Ready for Testing': '#4caf50',
  'In Testing': '#f44336',
  'Ready for PO Review': '#9e9e9e',
  Done: 'rgba(78, 157, 93, 0.3)',
  'On Hold': '#f44336',
};
