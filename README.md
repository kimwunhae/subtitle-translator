<div align="center">

# Udemy Dual Subtitle Translator (Chrome Extension)

![Extension Icon](public/icons/icon-128.png)
</div>

Udemy 강의의 현재 자막을 선택한 언어로 번역해 원문 아래에 이중 자막으로 보여주는 크롬 확장 프로그램입니다.

## Screenshots

<div align="center">

![Dual Subtitle](docs/screenshots/player-dual-subtitle.png)
![Popup UI](docs/screenshots/popup-ui.png)
</div>

## Features

- 번역 ON/OFF 스위치
- 번역 언어 선택
- 영상 자막 아래에 번역문을 함께 표시(이중 자막)
- 동일 문장 재등장 시 번역 캐시 사용

## Tech Stack

- TypeScript
- React
- Vite
- Chrome Extension Manifest V3

## Quick Start

1. 의존성 설치
   - `npm install`
2. 빌드
   - `npm run build`
3. 크롬에서 `chrome://extensions` 접속
4. 우측 상단 **개발자 모드** 활성화
5. **압축해제된 확장 프로그램을 로드** → `dist` 폴더 선택
6. 확장 아이콘이 표시되는지 확인

## Usage

1. Udemy 강의 재생 페이지를 엽니다.
2. 확장 아이콘 클릭 → 번역 스위치 활성화.
3. 원하는 번역 언어를 선택합니다.
4. 기본 자막 아래에 번역 자막이 자동으로 표시됩니다.

## Dev Reload (자동 반영)

`dist` 빌드 변경을 감지해 확장 프로그램을 자동 리로드합니다.

1. 빌드 감시 실행
   - `npm run build:watch`
2. 리로드 서버 실행
   - `npm run reload:server`
3. 크롬 확장 프로그램에서 `dist` 폴더 로드

Udemy 강의 페이지가 열려 있을 때 변경 사항이 자동으로 반영됩니다.

## Icon Assets

- 위치: `public/icons/`
- 파일: `icon-16.png`, `icon-32.png`, `icon-48.png`, `icon-128.png`
- `manifest.json`의 `icons`, `action.default_icon`에 연결됨

## Permissions

- `storage`: 사용자 설정 저장
- `https://www.udemy.com/*`: Udemy 강의 페이지 접근
- `https://translate.googleapis.com/*`: 번역 API 호출
- `http://localhost:35729/*`: 개발 리로드 서버(개발 환경 전용)

## How It Works

- 콘텐츠 스크립트가 Udemy 자막 DOM 변화를 감지합니다.
- 백그라운드 서비스 워커가 번역 API를 호출합니다.
- 번역 텍스트를 원본 자막 요소에 추가 렌더링합니다.

## Notes

- Udemy 페이지 구조 변경 시 선택자 업데이트가 필요할 수 있습니다.
- 번역 API 가용성/정책에 따라 동작이 달라질 수 있습니다.

## Contributing

- 이슈/PR 환영합니다. 변경 사항이 있을 경우 간단한 설명과 스크린샷을 포함해 주세요.
- 코드는 `npm run build`를 통과해야 합니다.

## License

- MIT License
