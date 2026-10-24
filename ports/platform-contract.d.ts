/** Documentation of the existing Android bridge. Not a runtime adapter. */
export type Provider = 'tmdb' | 'mdblist';
export interface InstalledApp { pkg: string; label: string }
export interface CatalogStatus {
  tmdb: boolean;
  mdblist: boolean;
  transport?: string;
  [publicStatusField: string]: unknown;
}
export interface CatalogEnvelope {
  ok: boolean;
  data?: unknown;
  headers?: Record<string, string>;
  cached?: boolean;
  stale?: boolean;
  status?: number;
  retryAfter?: number;
  error?: string;
  code?: string;
  [publicResponseField: string]: unknown;
}
export interface CatalogTransport {
  status(): CatalogStatus;
  settings(): void;
  request(provider: Provider, path: string, params: Record<string, unknown>): Promise<CatalogEnvelope>;
}
export interface LegacyAndroidBridge {
  uiSoundsEnabled?(): boolean;
  setUiSoundsEnabled?(enabled: boolean): void;
  playUiSound?(effect: 'move' | 'click' | 'select' | 'cancel'): void;
  getApps(): string; // JSON InstalledApp[]
  getArt(appId: string): string;
  launch(appId: string): boolean;
  openSettings(): void;
  openSetting(key: string): boolean;
  openTrailer(youtubeId: string): boolean;
  /** App id of the platform's live TV, or "" when there is none (the UI then hides the card). */
  liveTvPackage?(): string;
  openLiveTv?(): boolean;
  homeStatus(): string; // JSON {redirect, service, amazonDisabled}
  setRedirect(enabled: boolean): void;
  restoreOriginalHome(): boolean;
  catalogStatus(): string; // JSON CatalogStatus; never credential values
  catalogRequest(id: string, provider: Provider, path: string, paramsJson: string): void;
  openCatalogSettings(): void;
  configureCatalogSections(publicSectionsJson: string): void;
}
