export async function POST(request) {
  try {
    const { image } = await request.json(); // base64 image

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_CREATE_APP_URL}/integrations/gpt-vision/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Extract the part number and part name from this printer part tag.

Look for:
1. Part Number - Usually a code format like "GM3-72468", "FM1-D581", etc. May be printed or handwritten. Often labeled as "Part No.", "P/N", or appears at the top of the tag.

2. Part Name - A description like "Canon Primary Charging Assembly" or "Fixing Unit". May be handwritten below the part number. Describes what the part is.

Return ONLY a JSON object with this exact structure (no markdown, no extra text):
{
  "part_number": "extracted number here",
  "part_name": "extracted name here"
}

If you cannot find either field, use an empty string "" for that field.`,
                },
                {
                  type: "image_url",
                  image_url: { url: image },
                },
              ],
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      console.error(
        "GPT Vision API error:",
        response.status,
        response.statusText,
      );
      return Response.json({
        part_number: "",
        part_name: "",
        error: "API request failed",
      });
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Remove markdown code blocks if present
    let cleanContent = content;
    if (cleanContent.includes("```")) {
      cleanContent = cleanContent
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "");
    }
    cleanContent = cleanContent.trim();

    const extracted = JSON.parse(cleanContent);

    console.log("OCR extracted:", extracted);
    return Response.json(extracted);
  } catch (error) {
    console.error("OCR Error:", error);
    return Response.json({
      part_number: "",
      part_name: "",
      error: error.message,
    });
  }
}
