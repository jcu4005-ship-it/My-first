import { forbidden } from "next/navigation";

/** proxy가 권한 없는 요청을 이 경로로 보냄 → 화면 그리기 전에 HTTP 403 (await 없이 즉시) */
export default function DeniedPage(): never {
  forbidden();
}
