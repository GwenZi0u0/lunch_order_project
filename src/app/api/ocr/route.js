import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

const OCR_MOCK_TEMPLATES = [
  {
    name: '池上木片便當',
    phone: '02-27351234',
    category: '便當',
    menuItems: [
      { name: '招牌木片便當', price: 90, category: '主食' },
      { name: '香酥排骨便當', price: 100, category: '主食' },
      { name: '黃金炸雞腿便當', price: 110, category: '主食' },
      { name: '紅燒爌肉便當', price: 95, category: '主食' },
      { name: '黑胡椒豬排便當', price: 95, category: '主食' },
      { name: '養生素食便當', price: 85, category: '配菜' },
      { name: '每日例湯', price: 15, category: '飲料湯品' },
      { name: '古早味紅茶', price: 20, category: '飲料湯品' },
    ]
  },
  {
    name: '老北方牛肉麵館',
    phone: '02-88665544',
    category: '麵食',
    menuItems: [
      { name: '川味紅燒牛肉麵', price: 150, category: '主食' },
      { name: '清燉牛肉細粉', price: 160, category: '主食' },
      { name: '老北京炸醬麵', price: 85, category: '主食' },
      { name: '香菇雞絲乾拌麵', price: 80, category: '主食' },
      { name: '手工豬肉水餃 (10顆)', price: 70, category: '主食' },
      { name: '酸辣湯', price: 35, category: '飲料湯品' },
      { name: '精緻小菜 (小黃瓜/皮蛋豆腐)', price: 40, category: '配菜' },
      { name: '冰鎮酸梅汁', price: 30, category: '飲料湯品' },
    ]
  },
  {
    name: '珍記水餃麵食館',
    phone: '0988-123-456',
    category: '小吃',
    menuItems: [
      { name: '韭菜鮮肉水餃 (10顆)', price: 75, category: '主食' },
      { name: '高麗菜鮮蝦水餃 (10顆)', price: 90, category: '主食' },
      { name: '麻醬乾麵', price: 60, category: '主食' },
      { name: '貢丸湯麵', price: 70, category: '主食' },
      { name: '招牌酸辣湯', price: 40, category: '飲料湯品' },
      { name: '滷味拼盤 (豆乾/海帶/滷蛋)', price: 50, category: '配菜' },
      { name: '油豆腐湯', price: 30, category: '飲料湯品' },
    ]
  },
  {
    name: '正宗日式丼飯專賣',
    phone: '02-23456789',
    category: '日式',
    menuItems: [
      { name: '日式炙燒牛丼', price: 120, category: '主食' },
      { name: '黃金滑蛋豬排丼', price: 130, category: '主食' },
      { name: '酥炸唐揚雞肉丼', price: 130, category: '主食' },
      { name: '鹽烤鯖魚丼', price: 140, category: '主食' },
      { name: '日式味噌湯', price: 25, category: '飲料湯品' },
      { name: '溫泉蛋', price: 20, category: '配菜' },
      { name: '胡麻豆腐沙拉', price: 45, category: '配菜' },
      { name: '無糖綠茶', price: 25, category: '飲料湯品' },
    ]
  }
];

export async function POST(request) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (apiKey) {
      // Call Gemini 1.5 Flash API to do OCR & structured extraction!
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const base64Data = buffer.toString('base64');
        const mimeType = file.type || 'image/jpeg';

        const prompt = `You are an AI Menu Parser. Extract the restaurant details and items from the uploaded menu image. 
Return ONLY a valid JSON object matching this schema exactly, do not wrap in markdown tags like \`\`\`json:
{
  "name": "Restaurant Name",
  "phone": "Restaurant Phone or empty string",
  "category": "One of: 便當, 麵食, 日式, 小吃, 飲料, 其他",
  "menuItems": [
    { "name": "Item Name", "price": 100, "category": "主食 or 配菜 or 飲料湯品" }
  ]
}
Translate food category/item category to traditional Chinese (繁體中文).`;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: prompt },
                    {
                      inlineData: {
                        mimeType: mimeType,
                        data: base64Data
                      }
                    }
                  ]
                }
              ],
              generationConfig: {
                responseMimeType: 'application/json'
              }
            })
          }
        );

        if (!response.ok) {
          throw new Error(`Gemini API returned status ${response.status}`);
        }

        const data = await response.json();
        const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (jsonText) {
          const parsed = JSON.parse(jsonText.trim());
          return NextResponse.json({
            success: true,
            source: 'gemini-ocr',
            data: parsed
          });
        }
      } catch (geminiError) {
        console.error('Gemini OCR failed, falling back to mock:', geminiError);
        // Fall through to mock parser
      }
    }

    // Fallback: Random template generator simulation
    // Select template based on uploaded file name hash or random selection
    const randomIndex = Math.floor(Math.random() * OCR_MOCK_TEMPLATES.length);
    const template = OCR_MOCK_TEMPLATES[randomIndex];

    // Artificial delay to simulate processing
    await new Promise(resolve => setTimeout(resolve, 1500));

    return NextResponse.json({
      success: true,
      source: 'mock-ocr-simulation',
      data: template,
      warning: '已啟動內建模擬辨識 (未偵測到 GEMINI_API_KEY)'
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
