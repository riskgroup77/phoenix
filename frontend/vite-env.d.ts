/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_MEDIA_URL?: string;
  readonly VITE_ENV?: 'development' | 'production';
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_DISABLE_SW?: string;
  readonly VITE_LEGAL_NAME?: string;
  readonly VITE_LEGAL_INN?: string;
  readonly VITE_LEGAL_ADDRESS?: string;
  readonly VITE_LEGAL_BANK?: string;
  readonly VITE_LEGAL_ACCOUNT?: string;
  readonly VITE_LEGAL_MFO?: string;
  readonly VITE_LEGAL_DIRECTOR?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
