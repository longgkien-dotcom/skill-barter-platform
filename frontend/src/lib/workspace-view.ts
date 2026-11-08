import type { Tab } from "./types";
// [BETA & LƯU TRẠNG THÁI]: Chỉ lưu tab/channel riêng theo user; Home khôi phục sau khi đối chiếu phiên với roster backend.
// [CẨN THẬN KHI SỬA]: Đây là sở thích giao diện, không cấp quyền đăng nhập; đóng storage không được làm gián đoạn các API nghiệp vụ.
interface WorkspaceView {
  tab: Tab;
  channel: "campus" | "online";
}
type ViewStorage = Pick<Storage, "getItem" | "setItem">;
const keyFor = (userId: string) => `skillbarter.workspace-view.v1.${userId}`;
function browserStorage(): ViewStorage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
export function readWorkspaceView(
  userId: string,
  storage = browserStorage(),
): WorkspaceView | null {
  try {
    const value = JSON.parse(storage?.getItem(keyFor(userId)) ?? "null");
    return value &&
      ["discovery", "sessions", "tribunal", "wallet"].includes(value.tab) &&
      ["campus", "online"].includes(value.channel)
      ? { tab: value.tab, channel: value.channel }
      : null;
  } catch {
    return null;
  }
}
export function writeWorkspaceView(
  userId: string,
  view: WorkspaceView,
  storage = browserStorage(),
): void {
  try {
    storage?.setItem(keyFor(userId), JSON.stringify(view));
  } catch {
    /* Không lưu được sở thích không ảnh hưởng phiên đăng nhập hoặc API. */
  }
}
