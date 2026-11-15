# valimini

객체의 속성별 규칙을 정의하고 검증 결과를 반환하는 작은 라이브러리입니다. 검증 코어는 DOM이나 프레임워크에 의존하지 않습니다.

## 개발과 검증

```bash
npm install
npm run dev        # HTML 폼 예제
npm test           # 타입 검사, 라이브러리 빌드, Node.js 테스트
npm run build      # dist/valimini.js, dist/index.d.ts
npm run build:demo # demo-dist/에 예제 웹 앱 빌드
npm run preview -- --outDir demo-dist
```

현재 패키지는 `private: true`이며 npm 배포는 설정하지 않았습니다.

## 다운로드

[GitHub Releases](https://github.com/dornol/valimini/releases)에서 JavaScript 파일을 내려받을 수 있습니다.

| 파일 | 용도 |
| --- | --- |
| `valimini.js` | `import`로 사용하는 ES 모듈 |
| `valimini.global.js` | 일반 `<script>`로 사용하는 전역 `Valimini` 객체 |
| `index.d.ts` | TypeScript 타입 선언 |

일반 HTML에서는 파일을 복사한 뒤 아래처럼 사용합니다.

```html
<script src="./valimini.global.js"></script>
<script>
  const validator = Valimini.createValidator({
    email: [Valimini.required(), Valimini.email()],
  });
  const result = validator.validate({ email: 'hello@example.com' });
</script>
```

모듈 방식에서는 웹 서버에서 제공하는 파일을 가져옵니다.

```html
<script type="module">
  import { createValidator, required } from './valimini.js';
  const validator = createValidator({ name: [required()] });
</script>
```

## 사용

빌드한 `dist/`를 웹 서버에서 제공하고 모듈로 가져옵니다. HTML 예제는 `src/main.ts`에서 확인할 수 있습니다.

```html
<form id="signup" novalidate>
  <input name="password" type="password" autocomplete="new-password">
  <input name="passwordConfirm" type="password" autocomplete="new-password">
  <button type="submit">검증</button>
</form>
<script type="module">
  import { createValidator, required, minLength, custom } from './dist/valimini.js';

  const validator = createValidator({
    password: [required(), minLength(8)],
    passwordConfirm: [
      required(),
      custom(
        (value, data) => value === data.password,
        '비밀번호가 일치하지 않습니다.',
        'match',
      ),
    ],
  });

  const form = document.querySelector('#signup');
  form.addEventListener('submit', event => {
    event.preventDefault();
    const result = validator.validate(Object.fromEntries(new FormData(form)));

    if (!result.valid) {
      alert(result.firstError.message);
      const input = form.elements.namedItem(result.firstError.name);
      if (input instanceof HTMLElement) input.focus();
      return;
    }
    // 검증 통과 후 원하는 작업을 수행합니다.
  });
</script>
```

데이터 속성과 input의 `name`을 맞춥니다. `Object.fromEntries(new FormData(form))`는 같은 이름의 여러 입력 중 마지막 값만 보존합니다. 다중 선택이나 체크박스 그룹은 직접 배열로 수집해 전달하세요.

## 반환값

```js
// 실패
{
  valid: false,
  firstError: {
    field: 'passwordConfirm',
    path: ['passwordConfirm'],
    name: 'passwordConfirm',
    code: 'match',
    message: '비밀번호가 일치하지 않습니다.',
  },
  errors: {
    passwordConfirm: [
      { code: 'match', message: '비밀번호가 일치하지 않습니다.', path: ['passwordConfirm'], name: 'passwordConfirm' },
    ],
  },
}

// 성공
{ valid: true, firstError: null, errors: {} }
```

## 규칙과 동작

- `required(message?)`: `undefined`, `null`, 빈 문자열, 공백 문자열, 빈 배열을 거부합니다. `0`과 `false`는 유효합니다.
- `email(message?)`: 문자열의 기본 이메일 형식을 확인합니다. 메일함 존재 여부는 검사하지 않습니다.
- `minLength(limit, message?)`, `maxLength(limit, message?)`: 문자열 또는 배열의 길이를 검사합니다. 문자열 길이는 JavaScript의 `.length` 기준입니다.
- `pattern(regex, message?)`: 문자열 정규식 검사입니다. `g`, `y` 플래그를 사용해도 반복 검증 결과가 바뀌지 않으며 원본 정규식 상태를 변경하지 않습니다.
- `number(options?, message?)`: 유한한 숫자를 검사합니다. 기본은 number 타입만 허용하며 옵션으로 숫자 문자열과 콤마를 허용할 수 있습니다. `number(message)` 형태도 유지합니다.
- `integer(options?, message?)`: 같은 숫자 옵션으로 유한한 정수를 검사합니다. `integer(message)` 형태도 유지합니다.
- `min(limit, options?, message?)`, `max(limit, options?, message?)`: 같은 숫자 옵션으로 최솟값·최댓값을 경계 포함으로 검사합니다. 한계값은 유한한 숫자여야 합니다. 기존 `min(limit, message)`, `max(limit, message)`도 지원합니다.
- `url(message?)`: 절대 HTTP/HTTPS URL을 검사합니다. 상대 경로와 다른 프로토콜, 공백을 포함한 입력은 거부합니다. 접속 가능 여부는 확인하지 않습니다.
- `oneOf(values, message?)`: 허용 목록에 있는 값인지 검사합니다. 타입을 변환하지 않으며 객체는 참조 기준으로 비교합니다. 목록은 생성 시 복사합니다.
- `matchesField(field, message?)`: 현재 값과 다른 최상위 필드의 값을 `===`로 비교합니다. 대상 필드가 없으면 실패합니다.
- `accepted(message?)`: 정확히 `true`여야 통과합니다. 누락되거나 비어 있어도 검사합니다.
- `notOneOf(values, message?)`: 금지 목록의 값이면 실패합니다. 목록을 복사하며 비교 방식은 `Set`과 같습니다.
- `notMatchesField(field, message?)`: 대상 필드와 `!==`이면 통과합니다. 대상 필드가 없으면 통과합니다.
- `requiredIf(predicate, message?)`: 전체 데이터에 대한 동기 조건이 `true`일 때 빈 값을 거부합니다. 조건은 매 검증마다 평가하며 boolean을 반환해야 합니다.
- `date(message?)`: 실제 존재하는 `YYYY-MM-DD` 날짜를 검사합니다. 연도는 0001~9999이며 Date 객체와 시각 문자열은 받지 않습니다.
- `before(limit, message?)`, `after(limit, message?)`: 유효한 날짜가 기준 날짜보다 이전·이후인지 검사합니다. 기준 날짜 당일은 제외하며, 잘못된 기준 날짜는 룰 생성 시 `RangeError`를 발생시킵니다.
- `minItems(limit, message?)`, `maxItems(limit, message?)`: 배열 항목 수를 경계 포함으로 검사합니다. 빈 배열도 개수를 검사합니다. 누락·null·빈 문자열은 선택 항목으로 건너뛰므로 필수 배열에는 `required()`도 사용하세요.
- `uniqueItems(message?)`: 배열 중복을 검사합니다. `Set` 기준으로 비교하여 NaN끼리는 중복이고, 객체는 같은 참조일 때만 중복입니다.
- `custom((value, data) => boolean, message, code?)`: 현재 값과 전체 데이터를 사용하는 동기 규칙입니다. 기본 코드는 `custom`입니다.

빈 값은 일반 규칙에서 건너뜁니다. `required`, `requiredIf`, `accepted`는 빈 값에서도 실행하며, 배열 개수 규칙은 빈 배열의 길이도 검사합니다. 필수 항목에는 `required()`를 추가하세요. 각 필드에서 처음 실패한 규칙의 오류를 수집하고 다른 필드의 검증은 계속합니다. `each`가 실패하면 각 항목의 오류를 모으며, 항목별로는 처음 실패한 규칙까지만 검사합니다. 객체 항목은 각 속성의 첫 오류를 수집합니다. `firstError`는 규칙 객체의 필드 순서에 따릅니다. 정수 형태의 필드 이름은 JavaScript 객체 순서에 따라 숫자 순으로 처리됩니다.

누락된 필드는 `undefined`로 검사하고, 규칙에 없는 필드는 무시합니다. 규칙 객체의 키는 문자 그대로의 속성 이름이며 점이나 대괄호를 경로로 해석하지 않습니다. 중첩 리스트는 `each`와 검증기를 조합해 검사합니다. 검증기는 입력을 변경하지 않습니다. 사용자 정의 규칙도 입력을 변경하지 않도록 작성하세요.

비객체 입력과 boolean을 반환하지 않는 규칙은 `TypeError`를 발생시킵니다. 사용자 정의 규칙이 던진 예외도 호출자에게 전달됩니다. 비동기 검증은 아직 지원하지 않습니다.

## 저장소 설정

텍스트 파일은 UTF-8과 LF 줄바꿈을 사용합니다. 환경 파일, 의존성, 빌드 결과와 로컬 IDE 파일은 Git에서 제외합니다. `.env.example`, 패키지 잠금 파일, `.agents/skills/`는 버전 관리할 수 있습니다.

## 추가 룰 사용 예제

```js
import {
  createValidator, required, pattern, number, integer,
  min, max, url, oneOf, matchesField,
} from './dist/valimini.js';

const validator = createValidator({
  username: [required(), pattern(/^[a-z][a-z0-9_]{2,19}$/)],
  age: [required(), number(), integer(), min(14), max(120)],
  homepage: [url()],
  role: [required(), oneOf(['user', 'admin'])],
  passwordConfirm: [required(), matchesField('password', '비밀번호가 일치하지 않습니다.')],
});
```

HTML 입력의 문자열은 자동 변환하지 않습니다. 숫자 input은 `valueAsNumber`를 사용하거나 직접 변환하세요. 빈 문자열을 `Number('')`로 변환하면 `0`이 되므로 빈 값을 먼저 구분해야 합니다.

```js
const rawAge = form.elements.namedItem('age').value;
const data = {
  ...Object.fromEntries(new FormData(form)),
  age: rawAge.trim() === '' ? undefined : Number(rawAge),
};
const result = validator.validate(data);
```

## 콤마 숫자와 추가 규칙

```js
import {
  createValidator, required, number, integer, min, max, accepted,
  requiredIf, notOneOf, notMatchesField, date, before, after,
  minItems, maxItems, uniqueItems,
} from './dist/valimini.js';

const numeric = { allowString: true, thousandsSeparator: ',' };
const validator = createValidator({
  price: [required(), number(numeric), min(1000, numeric), max(1000000, numeric)],
  quantity: [required(), integer({ allowString: true }), min(1, { allowString: true })],
  terms: [accepted('약관에 동의해주세요.')],
  address: [requiredIf(data => data.delivery === true, '주소를 입력해주세요.')],
  username: [required(), notOneOf(['admin', 'root'])],
  newPassword: [required(), notMatchesField('oldPassword')],
  birthday: [date(), before('2027-01-01')],
  reservation: [date(), after('2026-01-01'), before('2027-01-01')],
  tags: [minItems(1), maxItems(5), uniqueItems()],
});

const formData = new FormData(form);
const data = {
  ...Object.fromEntries(formData),
  // 체크박스의 기본 문자열 "on"은 accepted()가 허용하지 않습니다.
  terms: form.elements.namedItem('terms').checked,
  delivery: form.elements.namedItem('delivery').checked,
  tags: formData.getAll('tags'),
};
const result = validator.validate(data);
```

숫자 문자열 옵션은 `number`, `integer`, `min`, `max`에 동일하게 전달하세요. 기존 숫자 타입도 계속 허용합니다. `allowString: true`만 지정하면 일반 십진수 문자열을, `thousandsSeparator: ','`도 지정하면 올바른 천 단위 콤마를 허용합니다. 구분자 옵션만 지정하면 문자열 허용이 활성화되지는 않습니다.

`"1,000"`, `"1,000.50"`, `"-1,000"`은 허용하고 `"1,00"`, `"1,2,3"`, `"01,000"`은 거부합니다. 앞뒤 공백은 제거해서 검사합니다. 지수 표기, 16진수, 소수점 앞뒤 숫자가 생략된 문자열은 지원하지 않습니다. 빈 문자열은 기존 선택 항목 정책에 따릅니다.

검사 중에만 JavaScript Number로 해석하며 원본 문자열은 변경하지 않습니다. 매우 큰 정수와 소수의 정밀도는 JavaScript Number의 범위를 따릅니다. TypeScript에서 옵션 객체를 변수로 공유할 때는 `NumericOptions` 타입 또는 `as const`를 사용하면 됩니다.

## 시간 검증

```js
import { createValidator, required, time, afterTime, beforeTime } from './dist/valimini.js';

const validator = createValidator({
  contactTime: [required(), time(), afterTime('09:00'), beforeTime('18:00')],
  exactTime: [
    time({ seconds: true }, '초까지 입력해주세요.'),
    afterTime('09:00:00', { seconds: true }),
    beforeTime('18:00:00', { seconds: true }),
  ],
});
```

- `time(options?, message?)`: 기본은 24시간제 `HH:mm`, `{ seconds: true }`이면 `HH:mm:ss`를 받습니다. `time(message)`도 가능합니다.
- `beforeTime(limit, options?, message?)`, `afterTime(limit, options?, message?)`: 기준 시각보다 이전·이후인지 검사합니다. 기준 시각 자체는 제외합니다. 두 번째 인수에 메시지만 전달해도 됩니다.
- `00:00`~`23:59`, 초는 `00`~`59`만 허용합니다. `24:00`, `9:00`, 타임존, 앞뒤 공백은 허용하지 않습니다. 시간대 변환이나 자정을 넘는 구간 비교는 하지 않습니다.
- 기준 시각도 지정한 형식과 일치해야 하며 잘못된 기준은 룰 생성 시 `RangeError`를 발생시킵니다. 빈 값은 선택 항목 정책을 따릅니다.

## 리스트의 각 항목 검증

```js
import { createValidator, required, email, integer, min, each, minItems } from './dist/valimini.js';

const userValidator = createValidator({
  name: [required()],
  age: [required(), integer(), min(0)],
});

const validator = createValidator({
  emails: [minItems(1), each([required(), email()])],
  users: [each(userValidator)],
});

const result = validator.validate({
  emails: ['hello@example.com'],
  users: [{ name: '홍길동', age: 20 }, { name: '김철수', age: -1 }],
});
// result.firstError:
// {
//   field: 'users',
//   path: ['users', 1, 'age'],
//   name: 'users[1].age',
//   code: 'min',
//   message: '0 이상 입력해주세요.',
// }
```

`each(rules, message?)`는 각 항목에 규칙 배열을 적용합니다. `each(validator, message?)`는 각 객체에 별도 검증기를 적용합니다. 배열이 아닌 값은 `each` 오류, 객체 검증기에 전달된 비객체 항목은 `object` 오류를 반환합니다. 누락되거나 빈 리스트는 선택 항목으로 허용하므로 필수 리스트에는 `required()`, 최소 개수에는 `minItems()`를 추가하세요.

단순 항목 규칙의 `custom`, `requiredIf`, 필드 비교 룰은 리스트를 가진 부모 데이터를 받습니다. 객체 검증기의 규칙은 해당 항목 객체를 받습니다. `each([each([...])])`와 객체 검증기를 조합해 여러 단계 리스트도 검사할 수 있습니다.

`errors`는 기존처럼 최상위 필드로 묶습니다. 예를 들어 여러 사용자에게 오류가 있으면 `errors.users`에 각 오류의 `path`, `name`과 함께 모읍니다. `firstError`는 필드 선언 순서, 배열 인덱스 순서, 객체 내부 필드 순서로 결정합니다.

## 오류 경로와 HTML 연결

모든 오류에는 `path`와 `name`이 포함됩니다. `firstError.field`는 최상위 필드 이름입니다.

| path | name |
| --- | --- |
| `["email"]` | `email` |
| `["users", 2, "age"]` | `users[2].age` |
| `["user.name"]` | `["user.name"]` |
| `["users", "2"]` | `users["2"]` |

`pathToName(path)`를 내보내므로 같은 규칙으로 input 이름을 만들 수 있습니다. 일반 식별자는 점으로, 숫자 인덱스는 대괄호로 연결합니다. 점·괄호·공백 등이 포함된 속성과 숫자 문자열 키는 JSON 문자열로 인용한 대괄호로 표현합니다. 특수 문자가 포함된 이름도 `namedItem`으로 직접 찾으며 CSS 선택자로 조합할 필요가 없습니다.

```html
<input name="users[2].age">
```

```js
if (!result.valid) {
  alert(result.firstError.message);
  const input = form.elements.namedItem(result.firstError.name);
  if (input instanceof HTMLElement) input.focus();
}
```

HTML 이름과 객체 구조는 자동 변환하지 않습니다. 아래처럼 리스트를 직접 만들어 전달하세요. 객체의 숫자는 기존 숫자 룰 정책을 따릅니다.

```js
const data = new FormData(form);
const rawAge = data.get('users[0].age');
const result = validator.validate({
  emails: data.getAll('emails'),
  users: [{
    name: data.get('users[0].name'),
    age: rawAge === null || String(rawAge).trim() === '' ? undefined : Number(rawAge),
  }],
});
```

## GitHub Release

`package.json`과 `package-lock.json`의 버전을 갱신하고 커밋한 다음 동일한 버전 태그를 푸시합니다.

```bash
# 예: 버전이 0.0.1인 커밋에서 실행
git tag v0.0.1
git push origin main v0.0.1
```

`.github/workflows/release.yml`이 태그와 패키지 버전의 일치를 검사하고 `npm ci`, `npm test`, 데모 빌드를 실행한 다음 GitHub Release에 두 JS 파일과 타입 선언을 첨부합니다. npm 레지스트리 배포는 수행하지 않습니다. 태그와 공개된 릴리즈 파일은 해당 버전의 배포 기준으로 유지하고, 변경 사항은 새 버전으로 릴리즈합니다.

태그 푸시 후 자동 실행되지 않거나 재시도가 필요하면 Actions → Release → Run workflow에서 기존 태그를 입력할 수 있습니다. CLI에서는 `gh workflow run release.yml -f tag=v0.0.1`로 실행합니다. 이미 공개된 같은 버전의 Release가 있으면 새로 만들지 않고 실패하므로 기존 파일을 덮어쓰지 않습니다.
