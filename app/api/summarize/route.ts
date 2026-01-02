import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server"; // currentUser нэмэв
import { prisma } from "@/lib/prisma";
import { genAI } from "@/lib/openai";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    const user = await currentUser(); // Clerk-ээс хэрэглэгчийн мэдээллийг авах

    if (!userId || !user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { title, content, maxLength = 150 } = await req.json();
    if (!title || !content) {
      return new NextResponse("Missing fields", { status: 400 });
    }

    // ЗАСВАР: Upsert ашиглан хэрэглэгчийг шалгах ба байхгүй бол үүсгэх
    const dbUser = await prisma.user.upsert({
      where: { clerkId: userId },
      update: {}, // Хэрэв байгаа бол юу ч өөрчлөхгүй
      create: {
        clerkId: userId,
        email: user.emailAddresses[0].emailAddress, // Clerk-ээс имэйлийг нь авах
        // Хэрэв name талбар байгаа бол:
        // name: `${user.firstName} ${user.lastName}`,
      },
    });

    // ЗАСВАР: Моделийн нэрийг зөв болгох (gemini-1.5-flash эсвэл gemini-2.0-flash)
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    const result = await model.generateContent(
      `Доорх нийтлэлийг ${maxLength} үгнээс хэтрэхгүйгээр монгол хэл дээр хураангуйлж бич:\n\n${content}`
    );

    const response = await result.response;
    const summary = response.text();

    const article = await prisma.article.create({
      data: {
        title,
        content,
        summary,
        userId: dbUser.id,
      },
    });

    return NextResponse.json(article, { status: 201 });
  } catch (err) {
    console.error("SUMMARIZE ERROR:", err);
    return new NextResponse("Server error", { status: 500 });
  }
}
