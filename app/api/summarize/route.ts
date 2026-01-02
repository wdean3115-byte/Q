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

    const { title, content, maxLength = 150 } = await req.json();
    if (!title || !content) {
      return new NextResponse("Missing fields", { status: 400 });
    }

    // 1. Хэрэглэгчийг өгөгдлийн санд байгаа эсэхийг баталгаажуулах
    const dbUser = await prisma.user.upsert({
      where: { clerkId: userId },
      update: {},
      create: {
        clerkId: userId,
        email: user.emailAddresses[0].emailAddress,
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
      },
    });

    // 2. Gemini-г зөв моделоор дуудах (gemini-1.5-flash ашиглах нь хамгийн тогтвортой)
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash", 
    });

    const prompt = `Доорх нийтлэлийг ${maxLength} үгнээс хэтрэхгүйгээр монгол хэл дээр хураангуйлж бич:\n\n${content}`;

    const result = await model.generateContent(prompt);
    
    // 3. ХАРИУЛТ АВАХ ХЭСЭГ (Ингэж бичих нь илүү найдвартай)
    const response = await result.response;
    const summary = response.text();

    if (!summary) {
      throw new Error("Gemini failed to generate summary");
    }

    // 4. Өгөгдлийн санд хадгалах
    const article = await prisma.article.create({
      data: {
        title,
        content,
        summary,
        userId: dbUser.id, // Энд dbUser-ийн ID-г ашиглаж байна
      },
    });

    return NextResponse.json(article, { status: 201 });

  } catch (err: any) {
    // Алдааг консол дээр тодорхой харах
    console.error("FULL ERROR DETAILS:", err);
    
    // Хэрэв Gemini-ийн API key буруу бол энд мэдэгдэнэ
    if (err.message?.includes("API_KEY_INVALID")) {
      return new NextResponse("Invalid Gemini API Key", { status: 500 });
    }

    return new NextResponse(`Server error: ${err.message}`, { status: 500 });
  }
}
