// Quick unit test for smart-grader fast path + ai-image-grader normalizers.
// Run: cd /home/z/mensat-alqaid && bun scripts/test-smart-grader.ts
import { quickSmartMatch, normalizeForMatch } from '../src/lib/smart-grader'
import { exactEquivalent, extractImageMediaIds } from '../src/lib/ai-image-grader'

var pass = 0
var fail = 0
function check(name: string, cond: boolean) {
  if (cond) { pass++; console.log('PASS — ' + name) }
  else { fail++; console.log('FAIL — ' + name) }
}

// ---- quickSmartMatch (the no-AI fast path) ----
// 1. exact final value (Arabic label + western digits vs plain)
check('final value equal: الاجابة: 1952 vs 1952', quickSmartMatch('الاجابة: 1952', '1952', []) === true)
// 2. Arabic-Indic digits normalized: ١٩٥٢ = 1952
check('arabic digits: ١٩٥٢ vs 1952', quickSmartMatch('سنة الثورة ١٩٥٢', '1952', []) === true)
// 3. accepted answer (short) contained in student line
check('accepted contained: student line contains 1952', quickSmartMatch('قامت الثورة في 1952م ضد الاحتلال', '', ['1952']) === true)
// 4. trailing-punctuation/decoration tolerance
check('punctuation tolerance', quickSmartMatch('الجواب = 3.', '3', []) === true)
// 5. wrong value → null (goes to AI, NOT auto-correct)
check('wrong value → null', quickSmartMatch('1945', '1952', []) === null)
// 6. empty student → false (not answered)
check('empty → false', quickSmartMatch('', '1952', []) === false)
// 7. factor form aaaaaaa = a^7
check('factor form: aaaaaaa vs a^7', quickSmartMatch('aaaaaaa', 'a^7', []) === true)
// 8. student final contained in model final (model shows steps then final)
check('student final inside model final', quickSmartMatch('x = 5', 'الحل كامل = 5', []) === true)
// 9. normalization sanity
check('normalizeForMatch trims and lowercases', normalizeForMatch('  HELLO  ') === 'hello')

// ---- exactEquivalent (local false-negative safety net) ----
check('1952م === 1952', exactEquivalent('1952م', '1952') === true)
check('١٩٥٢ === 1952', exactEquivalent('١٩٥٢', '1952') === true)
check('x^6y^4 === y^4x^6', exactEquivalent('x^6y^4', 'y^4x^6') === true)
check('2^10 === 1024', exactEquivalent('2^10', '1024') === true)
check('1/2 === 0.5', exactEquivalent('1/2', '0.5') === true)
check('1945 !== 1952', exactEquivalent('1945', '1952') === false)
check('labels tolerated: الجواب: 8 === 8', exactEquivalent('الجواب: 8', '8') === true)

// ---- extractImageMediaIds (image markers incl. corrupted) ----
var ids = extractImageMediaIds('حل السؤال\n[📷 صورة مرفقة: /api/files/cmabc123def456ghi7]') 
check('extract media id from /api/files/ marker', ids.length === 1 && ids[0] === 'cmabc123def456ghi7')
var ids2 = extractImageMediaIds('[📷 صورة مرفقة: cmt1234567890abcd(85owp8h/]')
check('extract cuid from corrupted marker', ids2.length === 1 && ids2[0].indexOf('cmt1234567890abcd') === 0)

console.log('\n==== smart-grader unit tests: ' + pass + ' passed, ' + fail + ' failed ====')
if (fail > 0) process.exit(1)
