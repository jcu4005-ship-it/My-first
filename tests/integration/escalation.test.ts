import { beforeAll, describe, expect, it } from "vitest";

import { requireTestEnv } from "../support/env";
import {
  createMember,
  dbQuery,
  grantRoleDirect,
  publicClient,
  upgradeToAal2,
  type TestMember,
} from "../support/fixtures";

/**
 * 공격자 입장 API 테스트 — 브라우저 없이 공개 키 + 본인 로그인 토큰만으로 직접 호출.
 * 번호(N*)는 docs/progress/STAGE-1-PLAN.md 6-2 목록과 같습니다.
 */
let a: TestMember;
let b: TestMember;
let host: TestMember;
let admin: TestMember;

beforeAll(async () => {
  requireTestEnv();
  a = await createMember("pa");
  b = await createMember("pb");
  host = await createMember("ph");
  admin = await createMember("pz");
  await grantRoleDirect(host.id, "host");
  await grantRoleDirect(admin.id, "admin");
  await dbQuery("update public.profile_private set phone = '01055556666' where user_id = $1", [b.id]);
  // 역할 부여 후 세션 갱신 불필요 (권한은 토큰이 아니라 DB에서 판단)
});

async function rolesOf(userId: string) {
  const rows = await dbQuery<{ role: string }>("select role::text from public.user_roles where user_id = $1 order by role", [userId]);
  return rows.map((r) => r.role);
}

describe("권한 상승 차단", () => {
  it("N1: 참가자가 user_roles에 admin 행 추가 → 거부", async () => {
    const { error } = await a.client.from("user_roles").insert({ user_id: a.id, role: "admin" });
    expect(error?.code).toBe("42501");
    expect(await rolesOf(a.id)).toEqual(["participant"]);
  });

  it("N2: 참가자가 자기 역할 행 수정·삭제 → 거부", async () => {
    const upd = await a.client.from("user_roles").update({ role: "admin" }).eq("user_id", a.id);
    expect(upd.error?.code).toBe("42501");
    const del = await a.client.from("user_roles").delete().eq("user_id", host.id);
    expect(del.error?.code).toBe("42501");
    expect(await rolesOf(host.id)).toEqual(["participant", "host"].sort());
  });

  it("N3: 참가자가 관리자 함수 직접 호출 → 거부", async () => {
    const r1 = await a.client.rpc("admin_set_user_role", { p_user_id: a.id, p_role: "admin", p_grant: true, p_reason: "self escalation" });
    expect(r1.error?.code).toBe("42501");
    const r2 = await a.client.rpc("admin_list_members", {});
    expect(r2.error?.code).toBe("42501");
    const r3 = await a.client.rpc("admin_set_member_status", { p_user_id: b.id, p_status: "suspended", p_reason: "attack attempt" });
    expect(r3.error?.code).toBe("42501");
    expect(await rolesOf(a.id)).toEqual(["participant"]);
  });

  it("N3: 최초 관리자 지정 함수는 외부 API에서 보이지 않는다", async () => {
    const r = await a.client.schema("private" as "public").rpc("bootstrap_first_admin", { p_email: a.email });
    expect(r.error).not.toBeNull();
    expect(await rolesOf(a.id)).toEqual(["participant"]);
  });

  it("N4: 토큰 메타데이터에 role: admin을 넣어도 관리자 권한이 생기지 않는다", async () => {
    const { error } = await a.client.auth.updateUser({ data: { role: "admin", roles: ["admin", "host"], is_admin: true } });
    expect(error).toBeNull();
    await a.client.auth.refreshSession();
    const r = await a.client.rpc("admin_set_user_role", { p_user_id: a.id, p_role: "admin", p_grant: true, p_reason: "metadata escalation" });
    expect(r.error?.code).toBe("42501");
    const logs = await a.client.from("audit_logs").select("id");
    expect(logs.data).toEqual([]);
    expect(await rolesOf(a.id)).toEqual(["participant"]);
  });

  it("N5·N6: 참가자가 자기 상태·성인 확인 열 수정 → 거부", async () => {
    const s = await a.client.from("profiles").update({ status: "active" }).eq("id", a.id);
    expect(s.error?.code).toBe("42501");
    const v = await a.client.from("profile_private").update({ adult_verified_at: new Date().toISOString() }).eq("user_id", a.id);
    expect(v.error?.code).toBe("42501");
  });

  it("호스트도 관리자 함수 호출 불가", async () => {
    const r = await host.client.rpc("admin_set_user_role", { p_user_id: host.id, p_role: "admin", p_grant: true, p_reason: "host escalation" });
    expect(r.error?.code).toBe("42501");
  });
});

describe("개인정보 보호", () => {
  it("N7: A는 B의 비공개 정보를 조회할 수 없다", async () => {
    const { data, error } = await a.client.from("profile_private").select("*").eq("user_id", b.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("N8: A가 B의 비공개 정보 수정 시도 → 변경 0건", async () => {
    const { data } = await a.client.from("profile_private").update({ phone: "01000000000" }).eq("user_id", b.id).select("user_id");
    expect(data).toEqual([]);
    const rows = await dbQuery<{ phone: string }>("select phone from public.profile_private where user_id = $1", [b.id]);
    expect(rows[0].phone).toBe("01055556666");
  });

  it("N9: 호스트는 참가자의 연락처를 조회할 수 없다", async () => {
    const { data } = await host.client.from("profile_private").select("phone").in("user_id", [a.id, b.id]);
    expect(data).toEqual([]);
  });

  it("N10: 비로그인은 비공개 정보·역할·동의·감사 기록 표에 접근할 수 없다", async () => {
    const anon = publicClient();
    for (const table of ["profile_private", "user_roles", "legal_consents", "audit_logs"]) {
      const { data, error } = await anon.from(table).select("*").limit(1);
      expect(error !== null || (data ?? []).length === 0, table).toBe(true);
    }
  });

  it("N11·N12: A는 B의 동의 이력·감사 기록을 볼 수 없고 추가할 수 없다", async () => {
    const consents = await a.client.from("legal_consents").select("*").eq("user_id", b.id);
    expect(consents.data).toEqual([]);
    const ins = await a.client.from("legal_consents").insert({ user_id: b.id, consent_type: "marketing", document_version: "x", agreed: true });
    expect(ins.error?.code).toBe("42501");
    const audit = await a.client.from("audit_logs").insert({ actor_kind: "admin", action: "fake" });
    expect(audit.error?.code).toBe("42501");
  });

  it("N16: 공개 프로필 응답에는 이메일·연락처가 없다", async () => {
    // 전체 열(*) 요청은 내부 열 때문에 거부되고, 공개 열만 요청할 수 있다
    const star = await a.client.from("profiles").select("*").eq("id", b.id);
    expect(star.error?.code).toBe("42501");
    const email = await a.client.from("profiles").select("email").eq("id", b.id);
    expect(email.error).not.toBeNull();
    const { data, error } = await a.client
      .from("profiles")
      .select("id, nickname, avatar_url, bio, status, created_at")
      .eq("id", b.id);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    const keys = Object.keys(data![0]);
    expect(keys.sort()).toEqual(["avatar_url", "bio", "created_at", "id", "nickname", "status"]);
    expect(JSON.stringify(data)).not.toContain(b.email);
    expect(JSON.stringify(data)).not.toContain("01055556666");
  });
});

describe("관리자 2단계 인증", () => {
  it("N13: 2단계 인증 전(aal1) 관리자는 관리자 함수를 쓸 수 없다", async () => {
    const r = await admin.client.rpc("admin_list_members", {});
    expect(r.error?.code).toBe("42501");
    const logs = await admin.client.from("audit_logs").select("id");
    expect(logs.data).toEqual([]);
  });

  it("2단계 인증 후(aal2) 관리자는 역할을 부여할 수 있고 감사 기록이 남는다", async () => {
    await upgradeToAal2(admin.client);
    const r = await admin.client.rpc("admin_set_user_role", {
      p_user_id: b.id,
      p_role: "host",
      p_grant: true,
      p_reason: "통합 테스트 호스트 부여",
    });
    expect(r.error).toBeNull();
    expect(await rolesOf(b.id)).toEqual(["host", "participant"].sort());
    const { data: logs } = await admin.client
      .from("audit_logs")
      .select("action, actor_id, target_id, reason")
      .eq("target_id", b.id)
      .eq("action", "role.grant");
    expect(logs).toEqual([{ action: "role.grant", actor_id: admin.id, target_id: b.id, reason: "통합 테스트 호스트 부여" }]);
  });

  it("N15: 관리자도 감사 기록을 수정·삭제할 수 없다", async () => {
    const del = await admin.client.from("audit_logs").delete().eq("target_id", b.id);
    expect(del.error?.code).toBe("42501");
    const upd = await admin.client.from("audit_logs").update({ reason: "tampered" }).eq("target_id", b.id);
    expect(upd.error?.code).toBe("42501");
  });

  it("N17: 정지된 회원은 프로필을 수정할 수 없다", async () => {
    const r = await admin.client.rpc("admin_set_member_status", { p_user_id: a.id, p_status: "suspended", p_reason: "통합 테스트 정지" });
    expect(r.error).toBeNull();
    const { data, error } = await a.client.from("profiles").update({ bio: "정지 중 수정" }).eq("id", a.id).select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
    const rows = await dbQuery<{ bio: string | null }>("select bio from public.profiles where id = $1", [a.id]);
    expect(rows[0].bio).not.toBe("정지 중 수정");
  });
});
