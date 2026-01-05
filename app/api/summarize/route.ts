import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { genAI } from "@/lib/openai";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    const user = await currentUser();

    if (!userId || !user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { title, content, maxLength = 150 } = body;

    if (!title || !content) {
      return new NextResponse("Missing fields", { status: 400 });
    }

    // 1. Хэрэглэгчийг шалгах/үүсгэх (Upsert)
    const dbUser = await prisma.user.upsert({
      where: { clerkId: userId },
      update: {},
      create: {
        clerkId: userId,
        email: user.emailAddresses[0].emailAddress,
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
      },
    });

    // 2. Gemini Model (Нэрийг зөв тогтмол хувилбараар ашиглах)
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    const prompt = `Доорх нийтлэлийг ${maxLength} үгнээс хэтрэхгүйгээр монгол хэл дээр хураангуйлж бич:\n\n${content}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const summary = response.text();

    if (!summary) {
      throw new Error("AI-аас хариу ирсэнгүй");
    }

    // 3. Өгөгдлийн санд хадгалах
    const article = await prisma.article.create({
      data: {
        title,
        content,
        summary,
        userId: dbUser.id,
      },
    });

    return NextResponse.json(article, { status: 201 });
  } catch (error: unknown) {
    // TypeScript-ийн алдааг (err: any) биш (error: unknown) гэж засав
    console.error("SUMMARIZE ERROR:", error);

    let message = "Сервер дээр алдаа гарлаа";
    if (error instanceof Error) {
      message = error.message;
    }

    if (message.includes("API_KEY_INVALID")) {
      return new NextResponse("Gemini API түлхүүр буруу байна", {
        status: 500,
      });
    }

    return new NextResponse(`Алдаа: ${message}`, { status: 500 });
  }
}
