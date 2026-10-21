# Агуулгын хяналт — багшид

`content/`-оос `npm run content:review`-ээр үүсгэсэн; гараар бүү засварла. Засварыг `content/scenarios/<slug>.json`-д хийж, дахин үүсгэнэ. Хянаж дууссан файлын `review_status`-ийг `"reviewed"` болгоно.

Шалгах зүйл: англи хэл түвшиндээ тохирсон эсэх (`intro_en`, жишээ өгүүлбэр), монгол утга зөв ба ойлгомжтой эсэх, зорилго (`goal_mn`) сценаритэй нийцэж буй эсэх.

## A1 · Бүлэг 1. Өдөр тутмын анхны яриа (`draft`)

### 1. Шинэ ангийнхантайгаа танилцах — `introduce-yourself` (`draft`)

| Талбар | Утга |
|---|---|
| Зорилго (goal_mn) | Өөрийгөө танилцуулж, нэр, хаанаас ирснээ хэлээд, нөгөө хүнээс энгийн асуулт асуух. |
| AI-ийн дүр / хэрэглэгчийн дүр | new classmate / student on the first day of class |
| Танилцуулга (intro_en) | Hi! I'm Emma. I'm new in this class. What's your name? |
| Нөхцөл (role_context, LLM-д) | You are Emma, a friendly new classmate on the first day of an English class. Ask the learner simple questions about their name, where they are from and what they like. Answer their questions about you. Use very short, simple sentences and common words. |

| # | Үг / хэллэг | Монгол утга | Жишээ (example_en) | Хянасан |
|---|---|---|---|---|
| 1 | my name is | миний нэр ... (өөрийгөө танилцуулах) | My name is Bat. | ☐ |
| 2 | I'm from | би ...-аас ирсэн | I'm from Mongolia. | ☐ |
| 3 | nice to meet you | танилцсандаа таатай байна | Nice to meet you, Emma. | ☐ |
| 4 | classmate | ангийн хүүхэд, ангийнхан | She is my new classmate. | ☐ |
| 5 | hobby | хобби, чөлөөт цагийн сонирхол | My hobby is music. | ☐ |

### 2. Кафед уух юм захиалах — `order-at-a-cafe` (`draft`)

| Талбар | Утга |
|---|---|
| Зорилго (goal_mn) | Кафед уух зүйл, хэмжээгээ сонгож захиалаад, үнийг нь асуух. |
| AI-ийн дүр / хэрэглэгчийн дүр | barista / customer |
| Танилцуулга (intro_en) | Hello! Welcome to Sunny Café. What would you like today? |
| Нөхцөл (role_context, LLM-д) | You are a friendly barista at Sunny Café. Take the learner's order: drink, size, here or to go. Tell them the price and thank them. Offer a small snack once. Use very short, simple sentences. |

| # | Үг / хэллэг | Монгол утга | Жишээ (example_en) | Хянасан |
|---|---|---|---|---|
| 1 | I'd like | би ... авмаар байна (эелдэг хүсэлт) | I'd like a coffee, please. | ☐ |
| 2 | a cup of | нэг аяга | A cup of tea, please. | ☐ |
| 3 | large | том (хэмжээ) | A large latte, please. | ☐ |
| 4 | how much | хэд вэ, ямар үнэтэй вэ | How much is it? | ☐ |
| 5 | to go | авч явах (гадагш) | A hot chocolate to go, please. | ☐ |

### 3. Дэлгүүрээс юм худалдаж авах — `buy-in-a-shop` (`draft`)

| Талбар | Утга |
|---|---|
| Зорилго (goal_mn) | Хайж буй зүйлээ хэлж, хэмжээ асууж, өмсөж үзээд төлбөрөө төлөх. |
| AI-ийн дүр / хэрэглэгчийн дүр | shop assistant / customer |
| Танилцуулга (intro_en) | Hi there! Welcome to our shop. Can I help you? |
| Нөхцөл (role_context, LLM-д) | You are a helpful shop assistant in a small clothes shop. Help the learner find what they want, ask about size and colour, offer the fitting room, and help them pay. Use very short, simple sentences. |

| # | Үг / хэллэг | Монгол утга | Жишээ (example_en) | Хянасан |
|---|---|---|---|---|
| 1 | I'm looking for | би ... хайж байна | I'm looking for a T-shirt. | ☐ |
| 2 | size | хэмжээ, размер | Do you have this in a small size? | ☐ |
| 3 | try on | өмсөж үзэх | Can I try it on? | ☐ |
| 4 | cheap | хямд | This bag is cheap. | ☐ |
| 5 | pay by card | картаар төлөх | Can I pay by card? | ☐ |

### 4. Зам асуух — `ask-for-directions` (`draft`)

| Талбар | Утга |
|---|---|
| Зорилго (goal_mn) | Хүссэн газар руугаа хэрхэн очихыг эелдгээр асууж, зааврыг ойлгосноо батлах. |
| AI-ийн дүр / хэрэглэгчийн дүр | passer-by / visitor in a new city |
| Танилцуулга (intro_en) | Hi! You look a little lost. Can I help you? |
| Нөхцөл (role_context, LLM-д) | You are a kind local person on a street in the city centre. The learner asks you for directions to a place (bank, station, museum, café). Give simple directions with left, right, straight and near. Repeat if they ask. Use very short, simple sentences. |

| # | Үг / хэллэг | Монгол утга | Жишээ (example_en) | Хянасан |
|---|---|---|---|---|
| 1 | excuse me | уучлаарай (хүний анхаарлыг татах) | Excuse me, where is the bank? | ☐ |
| 2 | where is | ... хаана байна вэ? | Where is the train station? | ☐ |
| 3 | turn left | зүүн тийш эргэх | Turn left at the park. | ☐ |
| 4 | go straight | чигээрээ явах | Go straight for two minutes. | ☐ |
| 5 | near | ойрхон, дэргэд | The museum is near the station. | ☐ |

## A2 · Бүлэг 1. Аялал, сургууль, ажлын өдөр тутам (`draft`)

### 1. Зочид буудалд бүртгүүлэх — `hotel-check-in` (`draft`)

| Талбар | Утга |
|---|---|
| Зорилго (goal_mn) | Захиалгаа хэлж бүртгүүлээд, өглөөний цай, өрөө суллах цаг зэргийг тодруулах. |
| AI-ийн дүр / хэрэглэгчийн дүр | hotel receptionist / guest arriving at the hotel |
| Танилцуулга (intro_en) | Good evening, and welcome to the Blue Sky Hotel. Do you have a reservation with us? |
| Нөхцөл (role_context, LLM-д) | You are a polite receptionist at the Blue Sky Hotel. Check the learner in: ask for their name and reservation, confirm the room and number of nights, and answer questions about breakfast, Wi-Fi and check-out time. Use simple, everyday sentences. |

| # | Үг / хэллэг | Монгол утга | Жишээ (example_en) | Хянасан |
|---|---|---|---|---|
| 1 | reservation | урьдчилсан захиалга | I have a reservation for two nights. | ☐ |
| 2 | check in | буудалд бүртгүүлж орох | I'd like to check in, please. | ☐ |
| 3 | single room | нэг хүний өрөө | I booked a single room. | ☐ |
| 4 | included | багтсан, үнэд орсон | Is breakfast included? | ☐ |
| 5 | check-out time | өрөө суллах цаг | What is the check-out time? | ☐ |

### 2. Эмийн санд — `at-the-pharmacy` (`draft`)

| Талбар | Утга |
|---|---|
| Зорилго (goal_mn) | Биеийн байдлаа тайлбарлаж, эмийг яаж уух, жор хэрэгтэй эсэхийг асуух. |
| AI-ийн дүр / хэрэглэгчийн дүр | pharmacist / customer who feels unwell |
| Танилцуулга (intro_en) | Hello, how can I help you today? Tell me what the problem is, and I'll find something for you. |
| Нөхцөл (role_context, LLM-д) | You are a friendly pharmacist. Ask the learner about their symptoms and how long they have had them. Suggest a simple over-the-counter product, explain how often to take it, and advise seeing a doctor if it gets worse. Do not give real medical diagnoses. Use simple, everyday sentences. |

| # | Үг / хэллэг | Монгол утга | Жишээ (example_en) | Хянасан |
|---|---|---|---|---|
| 1 | headache | толгойны өвчин | I have a bad headache. | ☐ |
| 2 | sore throat | хоолой өвдөх | I have a sore throat and a cough. | ☐ |
| 3 | prescription | эмчийн жор | Do I need a prescription for this? | ☐ |
| 4 | twice a day | өдөрт хоёр удаа | Take one tablet twice a day. | ☐ |
| 5 | side effects | гаж нөлөө | Does this medicine have any side effects? | ☐ |

### 3. Багштай даалгаврын талаар ярилцах — `talk-to-a-teacher` (`draft`)

| Талбар | Утга |
|---|---|
| Зорилго (goal_mn) | Даалгаврын талаар асуулт асууж, ойлгоогүй зүйлээ тайлбарлуулж, шаардлагатай бол хугацаа сунгуулах хүсэлт гаргах. |
| AI-ийн дүр / хэрэглэгчийн дүр | teacher / student |
| Танилцуулга (intro_en) | Hi, come in. You wanted to talk about the essay, right? How is it going? |
| Нөхцөл (role_context, LLM-д) | You are Mr. Brown, a patient teacher. The learner comes to your office to talk about an essay assignment. Answer their questions about the topic, length and deadline. If they ask politely and give a reason, you can give a short extension. Use simple, everyday sentences. |

| # | Үг / хэллэг | Монгол утга | Жишээ (example_en) | Хянасан |
|---|---|---|---|---|
| 1 | assignment | даалгавар | I have a question about the assignment. | ☐ |
| 2 | deadline | эцсийн хугацаа | When is the deadline? | ☐ |
| 3 | extension | хугацаа сунгалт | Could I have an extension until Monday? | ☐ |
| 4 | I'm not sure how to | ... яаж хийхээ сайн мэдэхгүй байна | I'm not sure how to start the essay. | ☐ |
| 5 | explain | тайлбарлах | Could you explain the topic again? | ☐ |

### 4. Хамт ажилладаг хүнтэйгээ чөлөөтэй ярилцах — `small-talk-with-a-colleague` (`draft`)

| Талбар | Утга |
|---|---|
| Зорилго (goal_mn) | Амралтын өдөр, ажлын долоо хоногийн талаар богино яриа өрнүүлж, хариу асуулт асуух. |
| AI-ийн дүр / хэрэглэгчийн дүр | colleague / colleague at the office |
| Танилцуулга (intro_en) | Morning! How was your weekend? Did you do anything fun? |
| Нөхцөл (role_context, LLM-д) | You are Sara, a friendly colleague. It is Monday morning in the office kitchen. Make small talk about the weekend, the week ahead and lunch plans. Ask follow-up questions and share a little about yourself. Use simple, everyday sentences. |

| # | Үг / хэллэг | Монгол утга | Жишээ (example_en) | Хянасан |
|---|---|---|---|---|
| 1 | weekend | амралтын өдрүүд (бямба, ням) | I visited my family at the weekend. | ☐ |
| 2 | how about you | та харин? (асуултыг буцааж асуух) | I'm fine, thanks. How about you? | ☐ |
| 3 | busy | завгүй | This week is really busy. | ☐ |
| 4 | lunch break | үдийн завсарлага | Let's get coffee in the lunch break. | ☐ |
| 5 | by the way | дашрамд хэлэхэд | By the way, did you see the new office? | ☐ |

## B1 · Бүлэг 1. Ажил, сургалт, аялалд санаагаа илэрхийлэх (`draft`)

### 1. Ажлын ярилцлага — `job-interview` (`draft`)

| Талбар | Утга |
|---|---|
| Зорилго (goal_mn) | Өөрийн туршлага, давуу талаа жишээтэй тайлбарлаж, яагаад энэ ажилд орохыг хүсэж байгаагаа хэлэх. |
| AI-ийн дүр / хэрэглэгчийн дүр | interviewer / job candidate |
| Танилцуулга (intro_en) | Good morning, and thank you for coming in today. I've had a look at your CV. To start, could you tell me a little about yourself? |
| Нөхцөл (role_context, LLM-д) | You are Ms. Lee, an interviewer at a mid-sized company hiring for an office assistant position. Ask common interview questions one at a time: about the candidate, their experience, strengths, a difficult situation, and why they want the job. Ask a short follow-up when an answer is vague. Be professional and encouraging. |

| # | Үг / хэллэг | Монгол утга | Жишээ (example_en) | Хянасан |
|---|---|---|---|---|
| 1 | experience | туршлага | I have two years of experience in sales. | ☐ |
| 2 | strength | давуу тал | One of my strengths is working in a team. | ☐ |
| 3 | responsible for | ... хариуцах | I was responsible for customer support. | ☐ |
| 4 | apply for | ... -д өргөдөл гаргах | I applied for this job because I enjoy working with people. | ☐ |
| 5 | deal with | шийдвэрлэх, зохицуулах | I can deal with difficult customers calmly. | ☐ |

### 2. Нислэг хойшилсон үед — `delayed-flight` (`draft`)

| Талбар | Утга |
|---|---|
| Зорилго (goal_mn) | Нислэг хойшилсон нөхцөлд асуудлаа тайлбарлаж, өөр сонголт, тусламж эелдгээр хүсэх. |
| AI-ийн дүр / хэрэглэгчийн дүр | airline agent / passenger |
| Танилцуулга (intro_en) | Hello, I'm sorry for the wait. Your flight to Seoul has been delayed by about four hours because of the weather. How can I help you? |
| Нөхцөл (role_context, LLM-д) | You are an airline agent at the airport desk. The learner's flight to Seoul is delayed by about four hours because of the weather. Explain the situation, answer questions, and offer options: waiting, rebooking on a later flight, or a meal voucher. Stay calm and polite, even if the passenger is upset. |

| # | Үг / хэллэг | Монгол утга | Жишээ (example_en) | Хянасан |
|---|---|---|---|---|
| 1 | delayed | хойшилсон, саатсан | My flight has been delayed. | ☐ |
| 2 | connecting flight | дамжин нисэх дараагийн нислэг | I'm worried I'll miss my connecting flight. | ☐ |
| 3 | rebook | өөр нислэгт шилжүүлж захиалах | Can you rebook me on a later flight? | ☐ |
| 4 | boarding pass | онгоцонд суух тасалбар | Here is my boarding pass. | ☐ |
| 5 | meal voucher | хоолны эрхийн бичиг | Could I get a meal voucher while I wait? | ☐ |

### 3. Солилцооны хөтөлбөрийн ярилцлага — `exchange-programme-interview` (`draft`)

| Талбар | Утга |
|---|---|
| Зорилго (goal_mn) | Гадаадад суралцахыг яагаад хүсэж байгаа, юунд бэлэн байгаагаа жишээтэй тайлбарлах. |
| AI-ийн дүр / хэрэглэгчийн дүр | admissions officer / student applicant |
| Танилцуулга (intro_en) | Hello, and welcome to the interview for our student exchange programme. We'd like to get to know you a little better. First, why would you like to study abroad? |
| Нөхцөл (role_context, LLM-д) | You are an admissions officer for a university student exchange programme. Interview the learner: ask why they want to study abroad, what they want to study, how they will handle challenges, and what they can share with other students. Ask for examples. Be warm and professional. |

| # | Үг / хэллэг | Монгол утга | Жишээ (example_en) | Хянасан |
|---|---|---|---|---|
| 1 | study abroad | гадаадад суралцах | I'd like to study abroad for one semester. | ☐ |
| 2 | improve | сайжруулах | I want to improve my English and my confidence. | ☐ |
| 3 | challenge | сорилт, бэрхшээл | Living alone will be a challenge, but I'm ready. | ☐ |
| 4 | culture | соёл | I'd like to learn about a new culture. | ☐ |
| 5 | adapt to | ... -д дасан зохицох | I can adapt to new situations quickly. | ☐ |

### 4. Хурал дээр санал бодлоо хэлэх — `give-an-opinion-in-a-meeting` (`draft`)

| Талбар | Утга |
|---|---|
| Зорилго (goal_mn) | Хоёр санааг харьцуулж, өөрийн байр сууриа шалтгаантай хэлээд, бусдын саналд хариу өгөх. |
| AI-ийн дүр / хэрэглэгчийн дүр | team lead / team member |
| Танилцуулга (intro_en) | Okay, everyone, let's move on to the next point. We need to choose between two ideas for the new project. I'd really like to hear what you think. |
| Нөхцөл (role_context, LLM-д) | You are Tom, a team lead running a short team meeting. The team must choose between two ideas for a new project: a mobile app or a website. Ask the learner for their opinion, ask why, raise one counter-argument, and ask what they suggest as a next step. Be respectful and keep the meeting moving. |

| # | Үг / хэллэг | Монгол утга | Жишээ (example_en) | Хянасан |
|---|---|---|---|---|
| 1 | in my opinion | миний бодлоор | In my opinion, the app is the better idea. | ☐ |
| 2 | I agree with | ... -тай санал нийлж байна | I agree with Sara on this point. | ☐ |
| 3 | on the other hand | нөгөө талаар | On the other hand, a website is cheaper. | ☐ |
| 4 | suggest | санал болгох | I suggest that we test both ideas first. | ☐ |
| 5 | budget | төсөв | We need to think about the budget. | ☐ |
