import { permanentRedirect } from "next/navigation";

/** 예전 주소(/for-hosts) → /become-a-host */
export default function ForHostsRedirect() {
  permanentRedirect("/become-a-host");
}
