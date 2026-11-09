import { permanentRedirect } from "next/navigation";

/** 예전 주소(/experts) → 새 호스트 목록(/hosts) */
export default function ExpertsRedirect() {
  permanentRedirect("/hosts");
}
