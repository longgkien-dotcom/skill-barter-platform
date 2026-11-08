import { createDemoApi, type ApiSnapshot, type DemoOptions } from "./demo-api";

export interface ApiStatus {
  mode: "detecting" | "backend" | "demo";
  persistent: boolean;
}
interface TransportOptions {
  baseUrl: string;
  fetcher?: typeof fetch;
  browser?: () => boolean;
  hostname?: () => string;
  demo?: DemoOptions;
  probeTimeout?: number;
  requestTimeout?: number;
}
const INITIAL_STATUS: ApiStatus = { mode: "detecting", persistent: true };
const loopback = (hostname: string) =>
  /^(localhost|127(?:\.\d+){3}|\[?::1\]?)$/i.test(hostname);

// [CHỌN NGUỒN]: Chỉ lỗi mạng/timeout mới bật kho trình duyệt; HTTP 4xx/5xx vẫn là lỗi thật của NestJS.
// [CẨN THẬN KHI SỬA]: Không retry POST sang nguồn khác: backend có thể đã commit trước khi mất response.
// [TÍNH NHẤT QUÁN]: Khi đã vào demo, giữ nguồn đến lúc tải lại trang; snapshot không được trộn hai bộ ID/ví.
export function createApiTransport(options: TransportOptions) {
  const fetcher =
    options.fetcher ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const isBrowser = options.browser ?? (() => typeof window !== "undefined");
  const hostname = options.hostname ?? (() => window.location.hostname);
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const demo = createDemoApi(options.demo);
  const listeners = new Set<() => void>();
  let status = INITIAL_STATUS;
  const isDemo = () => status.mode === "demo";
  let readiness: Promise<void> | undefined;
  function update(mode: ApiStatus["mode"]) {
    const next = { mode, persistent: mode !== "demo" || demo.isPersistent() };
    if (next.mode !== status.mode || next.persistent !== status.persistent) {
      status = next;
      listeners.forEach((listener) => listener());
    }
  }
  async function http(
    path: string,
    method = "GET",
    body?: unknown,
    signal?: AbortSignal,
    timeout = options.requestTimeout ?? 15000,
  ) {
    signal?.throwIfAborted();
    const controller = new AbortController();
    const abort = () => controller.abort(signal?.reason);
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(
      () => controller.abort(new DOMException("API timeout", "TimeoutError")),
      timeout,
    );
    try {
      return await fetcher(`${baseUrl}${path}`, {
        method,
        cache: "no-store",
        signal: controller.signal,
        headers:
          body === undefined
            ? undefined
            : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  }
  async function selectSource() {
    // localhost trên link công khai là máy của người xem; bỏ qua để tránh truy cập mạng riêng hoặc mixed content.
    let targetsLoopback = false;
    try {
      targetsLoopback = loopback(new URL(baseUrl).hostname);
    } catch {
      /* URL tương đối vẫn dùng fetch bình thường. */
    }
    if (isBrowser() && targetsLoopback && !loopback(hostname())) {
      update("demo");
      return;
    }
    try {
      await http(
        "/users",
        "GET",
        undefined,
        undefined,
        options.probeTimeout ?? 2000,
      );
      update("backend");
    } catch {
      if (isBrowser()) update("demo");
      else update("backend");
    }
  }
  function ready() {
    return (readiness ??= selectSource());
  }
  async function local<T>(
    path: string,
    method: string,
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<T> {
    try {
      return await demo.request<T>(path, method, body, signal);
    } finally {
      update("demo");
    }
  }
  async function request<T>(
    path: string,
    method = "GET",
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<T> {
    signal?.throwIfAborted();
    await ready();
    signal?.throwIfAborted();
    if (isDemo()) return local<T>(path, method, body, signal);
    let response: Response;
    try {
      response = await http(path, method, body, signal);
    } catch (error) {
      if (signal?.aborted) throw signal.reason ?? error;
      if (method === "GET" && isBrowser()) {
        update("demo");
        return local<T>(path, method, body, signal);
      }
      throw new Error(
        "Kết nối bị gián đoạn. Kết quả thao tác chưa được xác nhận; hãy tải lại dữ liệu trước khi thử lại.",
      );
    }
    signal?.throwIfAborted();
    // GET cũ về sau khi một GET khác mất mạng: bỏ response backend, không trộn dữ liệu với demo.
    if (method === "GET" && isDemo())
      return local<T>(path, method, body, signal);
    const data = await response.json().catch(() => null);
    signal?.throwIfAborted();
    if (method === "GET" && isDemo())
      return local<T>(path, method, body, signal);
    if (!response.ok) {
      throw new Error(
        Array.isArray(data?.message)
          ? data.message.join(" · ")
          : (data?.message ?? `API trả lỗi ${response.status}`),
      );
    }
    if (data === null) throw new Error("API trả dữ liệu không hợp lệ.");
    return data as T;
  }
  async function snapshot(): Promise<ApiSnapshot> {
    await ready();
    if (!isDemo()) {
      try {
        const [users, skills, zones, sessions, disputes] = await Promise.all([
          request<ApiSnapshot["users"]>("/users"),
          request<ApiSnapshot["skills"]>("/skills"),
          request<ApiSnapshot["zones"]>("/safe-zones"),
          request<ApiSnapshot["sessions"]>("/sessions"),
          request<ApiSnapshot["disputes"]>("/disputes"),
        ]);
        if (!isDemo()) return { users, skills, zones, sessions, disputes };
      } catch (error) {
        if (!isDemo()) throw error;
      }
    }
    try {
      return await demo.snapshot();
    } finally {
      update("demo");
    }
  }
  return {
    request,
    snapshot,
    ready,
    getStatus: () => status,
    getServerStatus: () => INITIAL_STATUS,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
