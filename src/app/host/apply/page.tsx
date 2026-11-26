import { permanentRedirect } from "next/navigation";

/** 예전 주소(/host/apply) → /become-a-host/apply */
export default function HostApplyRedirect() {
  permanentRedirect("/become-a-host/apply");
}
