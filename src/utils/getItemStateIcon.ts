import * as vscode from 'vscode';

export const getItemStateIcon = (color: string) =>
  vscode.Uri.from({
    scheme: 'data',
    path: `image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><rect width="24" height="24" fill="transparent"></rect><circle cx="12" cy="12" r="6" fill="${color}"></circle></svg>`,
  });
