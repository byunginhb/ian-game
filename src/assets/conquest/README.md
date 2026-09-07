# 내가 다 먹었다! 캐릭터 아트

2026-09-07에 단순 SVG 그림을 고해상도 캐릭터 아트로 교체했습니다. 원본을 자르거나 리샘플링하지 않고 프로젝트에 복사했습니다. 투명 배경의 동일한 그림을 선택 카드, 전장의 대장, 이동 군사, 결과 화면에서 사용합니다.

## 파일과 출처

| 파일 | 캐릭터 | 제작 / 출처 |
| --- | --- | --- |
| ninja-v2.png | 로이드 | 내장 image_gen 생성 |
| sonic-v2.png | 소닉 | 내장 image_gen 생성 |
| monkey-v2.png | 마법천자문 손오공 | 사용자 첨부 참고 이미지 기반 내장 image_gen 생성 및 배경 제거 |
| demon-v2.png | 마법천자문 대마왕 | 사용자 첨부 참고 이미지 기반 내장 image_gen 생성 및 배경 제거 |
| mario-v2.png | 마리오 | Nintendo 공식 캐릭터 아트 |
| iron-v2.png | 아이언맨 | Marvel Rivals 공식 캐릭터 전신 아트 |

마리오와 아이언맨은 내장 생성 도구의 출력 검토에서 반복 차단되어 공식 아트로 대체했습니다. CLI/API 생성 경로는 사용하지 않았습니다. Nintendo와 Marvel/NetEase의 캐릭터 및 원본 아트에 대한 권리를 주장하지 않습니다.

- [Nintendo 공식 캐릭터 페이지](https://mario.nintendo.com/characters/)
- [마리오 원본 PNG](https://mario.nintendo.com/static/0f10f738d1f9aa8292fa7d93c35f2a07/d6807/mario.png)
- [Marvel Rivals 공식 아이언맨 소개](https://www.marvelrivals.com/m/20241123/41360_1195687.html)
- [아이언맨 원본 PNG](https://r.res.easebar.com/pic/20241128/aa4ee42e-fc64-4082-91c7-a640da9db5c2.png)

아이언맨 원본의 좌우 투명 여백은 CSS의 object-fit과 SVG symbol의 viewBox로 표시 영역만 조절합니다. 원본 PNG는 변경하지 않았습니다.

## 최종 생성 프롬프트

### 로이드

Use case: stylized-concept. Create one exquisitely finished 3D character render of Lloyd, the green ninja from Ninjago, for a child's private game. Full body, centered, three-quarter front view, confident friendly pose, one golden katana held safely pointed down at his side. Recognizable yellow face visible through the emerald green ninja mask, expressive eyes, carefully layered green wrap costume, gold dragon embroidery, sculpted shoulder armor, black belt, wrapped boots. A beautiful high-end collectible figure with rounded appealing proportions, head approximately one third of total body height, believable anatomy for a toy, dimensional fabric folds, satin materials, beveled armor, finely resolved highlights and occlusion. Soft warm studio key light from upper left and delicate cool rim light. Precise polished sculpting, sophisticated color shading, no thick outlines, no flat vector appearance, no crude geometric shapes. Isolated with a genuinely transparent background, no colored backdrop, no pedestal, no border, no text, no watermark. Portrait canvas 1024x1536. Entire figure including sword and feet inside frame, about 82% canvas height with even generous margins. This is one individual usable game character cutout.

### 소닉

Use case: stylized-concept. Sonic the Hedgehog, with his recognizable swept-back cobalt blue quills, large joined white eye shape with green irises, tan muzzle and belly, small black nose, confident warm grin, iconic white gloves and red running shoes with white bands and gold buckles. One gloved hand on his hip and the other giving a thumbs-up, balanced standing pose, unmistakably Sonic, carefully designed shoe surfaces and smoothly sculpted quills. One exquisitely finished 3D character cutout for a child's private game, as a beautiful high-end collectible figure. Full body, centered, three-quarter front view, confident friendly standing pose, rounded appealing proportions, head approximately one third of total body height, professionally sculpted forms and accurate expressive face. Sophisticated shading, dimensional surfaces, soft warm studio key light from upper left, delicate cool rim light, fine ambient occlusion. Precise sculpting and detail, no thick outlines, no flat vector appearance, no crude geometric shapes. Genuinely transparent background, no colored backdrop, no pedestal, no border, no added text or watermark. Portrait canvas 1024x1536. Entire silhouette including feet inside frame, about 82% canvas height, generous even margins. One individual usable game character cutout.

### 손오공

참고 이미지의 빨간 뾰족머리, 금색 머리띠, 보라색 목도리, 초록 매듭, 주황 의상, 빨간 여의봉과 원숭이 꼬리를 살린 정교한 3D 전신 일러스트를 먼저 생성했습니다. 최종 투명 PNG를 만든 편집 프롬프트:

Use case: background-extraction. Edit target: the attached finished Son Ogong character illustration. Remove only the dark studio background, stone floor, background glow and floating particles. Return a clean character cutout on a genuinely transparent alpha-channel background. Preserve the character exactly: facial features and happy expression, hair, costume and textures, tail, hands, boots, and entire staff. Preserve original colors and detailed 3D shading. Do not redraw or redesign him. No opaque backdrop, no checkerboard painted into pixels. Full body and complete staff, nothing cropped.

### 대마왕

참고 이미지의 주황색 큰 뿔, 보랏빛 얼굴, 검은 갈기와 긴 수염, 보라색 어깨 구슬, 붉은 도포와 주황색 금빛 장식을 살린 정교한 3D 전신 일러스트를 먼저 생성했습니다. 최종 투명 PNG를 만든 편집 프롬프트:

Use case: background-extraction. Edit target: the attached finished Daemawang character illustration. Remove only the dark studio background, floor, background glow and floating particles. Return a clean character cutout on a genuinely transparent alpha-channel background. Preserve the character exactly: gray violet marked face, enormous segmented orange horns, black spiky hair and long beard, purple beads, crimson robes, orange trim, all costume textures and detailed 3D shading. Do not redraw or redesign him. No opaque backdrop, no checkerboard painted into pixels. Preserve the full body and both complete horn tips, nothing cropped.

## 확인

- 여섯 PNG의 알파 채널과 캐릭터 실루엣을 확인했습니다.
- 브라우저에서 여섯 이미지가 로드되는지, 선택 카드와 전장에 정상 표시되는지 확인합니다.
- 캐릭터 교체에 추가 패키지나 외부 이미지 요청은 필요하지 않습니다.
