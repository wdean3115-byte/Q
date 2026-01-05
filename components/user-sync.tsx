"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useRef } from "react";

export default function UserSync() {
  const { isSignedIn, user } = useUser();
  const syncedRef = useRef(false);

  useEffect(() => {
    // Only sync if signed in, user data is loaded, and we haven't synced yet
    if (isSignedIn && user && !syncedRef.current) {
      syncedRef.current = true;

      fetch("/api/users/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clerkId: user.id,
          email: user.primaryEmailAddress?.emailAddress,
          fullName: user.fullName,
          imageUrl: user.imageUrl,
        }),
      })
        .then(async (res) => {
          if (res.ok) {
            console.log("User synced to DB");
          } else {
            const errorText = await res.text();
            console.error(`Sync failed: ${res.status} - ${errorText}`);
            // Reset ref if it failed so it can try again on next render
            syncedRef.current = false;
          }
        })
        .catch((err) => {
          console.error("Sync network error:", err);
          syncedRef.current = false;
        });
    }
  }, [isSignedIn, user]);

  return null;
}
