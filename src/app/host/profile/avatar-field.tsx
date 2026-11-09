"use client";

import { ImageUploadField } from "@/components/forms/image-upload-field";
import { HOST_AVATAR_BUCKET } from "@/lib/hosting/avatar";

/** 프로필 사진 (본인 폴더에만 올라감) */
export function AvatarField({ userId, initialPath }: { userId: string; initialPath: string | null }) {
  return (
    <ImageUploadField
      bucket={HOST_AVATAR_BUCKET}
      userId={userId}
      initialPath={initialPath}
      name="avatarPath"
      label="프로필 사진"
      filePrefix="avatar"
      testIdPrefix="avatar"
      hint="jpg·png·webp, 5MB 이하. 본인이 찍었거나 사용 허락을 받은 사진만 올려 주세요. 저장을 눌러야 반영돼요."
    />
  );
}
