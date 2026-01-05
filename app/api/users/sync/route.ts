import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const clerkUser = await currentUser();
    if (!clerkUser) {
      return new NextResponse("User not found in Clerk", { status: 404 });
    }

    const email = clerkUser.emailAddresses?.[0]?.emailAddress;
    const name = `${clerkUser.firstName || ""} ${
      clerkUser.lastName || ""
    }`.trim();

    // The upsert handles the "if exists update, else create" logic automatically
    const user = await prisma.user.upsert({
      where: { clerkId: userId },
      update: {
        email: email,
        name: name || null,
      },
      create: {
        clerkId: userId,
        email: email,
        name: name || null,
      },
    });

    return NextResponse.json(user, { status: 200 });
  } catch (err: unknown) {
    // Check for Prisma P2002 (Unique constraint failed)
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      err.code === "P2002"
    ) {
      console.error(
        "Conflict: Email already exists under a different clerkId."
      );
      return new NextResponse("Email already in use", { status: 409 });
    }

    console.error("SYNC ERROR:", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
