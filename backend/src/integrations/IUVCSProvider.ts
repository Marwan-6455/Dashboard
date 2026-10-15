export interface UVCSChangesetRecord {
  changesetId: string;
  repositoryId: string;
  branch: string | null;
  comment: string;
  author: string;
  timestamp: string;
  affectedFiles?: string[];
  externalLink?: string | null;
  source: 'manual' | 'uvcs_api' | 'plastic_cli';
  validationStatus: 'unverified_manual' | 'verified_live' | 'failed_lookup';
}

export type UVCSProviderStatus =
  | 'not_configured'
  | 'manual_mode'
  | 'connection_testing'
  | 'connected_and_verified'
  | 'error';

export interface UVCSConnectionStatusResult {
  status: UVCSProviderStatus;
  message: string;
  provider: string;
  organization?: string;
  repository?: string;
  lastChecked: string;
  errorDetail?: string | null;
}

export interface IUVCSProvider {
  name: string;
  getStatus(): Promise<UVCSConnectionStatusResult>;
  testConnection(): Promise<UVCSConnectionStatusResult>;
  lookupChangeset(repositoryId: string, changesetId: string): Promise<UVCSChangesetRecord | null>;
}
