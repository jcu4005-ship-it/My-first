"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeNextPath } from "@/lib/safe-redirect";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Enrollment = { factorId: string; qrCode: string; secret: string };

/**
 * 관리자 OTP 등록·확인. 성공하면 로그인 세션이 aal2(2단계 인증 완료)로 올라갑니다.
 * 세션 수준은 서버(guards)와 DB(is_admin)가 각각 다시 확인합니다.
 */
export function MfaPanel() {
  const next = safeNextPath(useSearchParams().get("next"), "/admin");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    (async () => {
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) {
        setError("인증 정보를 불러오지 못했습니다. 다시 로그인해 주세요.");
        setBusy(false);
        return;
      }
      const verified = data.totp.find((f) => f.status === "verified");
      if (verified) {
        setFactorId(verified.id);
      } else {
        // 이전에 등록을 끝내지 못한 항목은 지우고 새로 등록
        for (const f of data.all.filter((f) => f.factor_type === "totp" && f.status !== "verified")) {
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        }
        const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: `admin-${Date.now()}`,
        });
        if (enrollError || !enrolled) {
          setError("인증 앱 등록을 시작하지 못했습니다.");
        } else {
          setFactorId(enrolled.id);
          setEnrollment({ factorId: enrolled.id, qrCode: enrolled.totp.qr_code, secret: enrolled.totp.secret });
        }
      }
      setBusy(false);
    })();
  }, []);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setError(undefined);
    const supabase = createSupabaseBrowserClient();
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    if (verifyError) {
      setError("인증 코드가 올바르지 않습니다. 앱에 표시된 6자리 숫자를 다시 입력해 주세요.");
      setBusy(false);
      return;
    }
    // 세션 수준(aal2)이 바뀌었으므로 화면을 새로 불러와 서버가 새 세션으로 다시 확인하게 함
    window.location.assign(next);
  }

  return (
    <div className="flex flex-col gap-6" data-testid="mfa-panel">
      <FormMessage message={error} />
      {enrollment && (
        <div className="flex flex-col gap-3 rounded-xl border p-4 text-sm">
          <p className="font-medium">1. 인증 앱(Google Authenticator 등)으로 QR 코드를 스캔하세요.</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- Supabase가 돌려주는 SVG data URI */}
          <img src={enrollment.qrCode} alt="2단계 인증 QR 코드" className="size-44 self-center bg-white p-2" />
          <p className="text-muted-foreground">
            스캔할 수 없으면 아래 키를 직접 입력하세요.
            <code className="mt-1 block break-all rounded bg-muted px-2 py-1 font-mono" data-testid="mfa-secret">
              {enrollment.secret}
            </code>
          </p>
        </div>
      )}
      {factorId && (
        <form onSubmit={verify} className="flex flex-col gap-3">
          <Label htmlFor="otp">{enrollment ? "2. 앱에 표시된 6자리 코드" : "인증 앱의 6자리 코드"}</Label>
          <Input
            id="otp"
            name="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Button type="submit" disabled={busy || code.trim().length !== 6}>
            확인
          </Button>
        </form>
      )}
      {busy && !factorId && <p className="text-sm text-muted-foreground">준비 중…</p>}
    </div>
  );
}
