/** DB 함수가 돌려준 오류를 사용자 문구로 변환 */
export function rpcErrorMessage(error: { code?: string; message: string } | null | undefined): string {
  if (!error) return "";
  const known = ["P0001", "P0002", "22023", "42501"];
  if (error.code && known.includes(error.code)) {
    return error.message.replace(/^forbidden: /, "");
  }
  if (error.code === "23514" && error.message.includes("meetup_sessions_capacity")) {
    return "이미 신청한 인원보다 정원을 줄일 수 없어요.";
  }
  if (error.code === "23514" && error.message.includes("meetup_sessions_time_order")) {
    return "끝나는 시간은 시작 시간보다 늦어야 해요.";
  }
  if (error.code === "23514" || error.code === "22P02") return "입력값을 다시 확인해 주세요.";
  if (error.code === "23505") return "이미 처리된 요청입니다.";
  return "처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}
