declare const process: { env: Record<string, string | undefined> };
declare const Buffer: { from(value: string, encoding?: string): { toString(encoding?: string): string } };
declare namespace JSX {
  interface IntrinsicAttributes { key?: string }
  interface IntrinsicElements { [elemName: string]: any }
}
declare namespace React { type ReactNode = unknown }
declare module "react" {
  export function useState<T>(initial: T): [T, (value: T | ((previous: T) => T)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: unknown[]): void;
  export function useMemo<T>(factory: () => T, deps: unknown[]): T;
  export function useCallback<T extends (...args: any[]) => any>(fn: T, deps: unknown[]): T;
}
declare module "next" { export type Metadata = Record<string, unknown>; }
declare module "next/server" { export class NextRequest extends Request { nextUrl: URL; } }
declare module "node:crypto" {
  export function createHmac(algorithm: string, key: string): { update(value: string): { digest(encoding: string): string } };
}
