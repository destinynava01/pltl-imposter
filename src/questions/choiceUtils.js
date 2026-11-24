// An answer choice is text, a picture, or a picture with text. Pictures are stored as
// "img:q/<uuid>.png" or "img:q/<uuid>.png|text", so votes, ties and the correct answer
// all still compare as plain strings.
const PICTURE_PREFIX = 'img:'
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

export const isPictureChoice = (choice) => typeof choice === 'string' && choice.startsWith(PICTURE_PREFIX)

// { path, text }: path is null for a text-only choice
export function parseChoice(choice) {
  if (!isPictureChoice(choice)) return { path: null, text: choice ?? '' }
  const rest = choice.slice(PICTURE_PREFIX.length)
  const split = rest.indexOf('|')
  return split < 0 ? { path: rest, text: '' } : { path: rest.slice(0, split), text: rest.slice(split + 1) }
}

export function buildChoice(path, text) {
  if (!path) return text
  return text ? `${PICTURE_PREFIX}${path}|${text}` : `${PICTURE_PREFIX}${path}`
}

// For sentences like 'answered "…"': the text if there is any, otherwise "Picture B"
export function choiceLabel(choice, choices = []) {
  const { path, text } = parseChoice(choice)
  if (!path) return choice
  if (text.trim()) return text.trim()
  const index = choices.indexOf(choice)
  return index >= 0 ? `Picture ${LETTERS[index]}` : 'a picture'
}

// A true/false question is one whose choices are exactly these two
export const TRUE_FALSE = ['True', 'False']
export const isTrueFalse = (choices = []) =>
  choices.length === 2 && choices[0] === TRUE_FALSE[0] && choices[1] === TRUE_FALSE[1]
// Open-response questions have no choices; students type answers and the leader judges them
export const isOpenResponse = (choices = []) => choices.length === 0
export const questionType = (choices) =>
  isOpenResponse(choices) ? 'open_response' : isTrueFalse(choices) ? 'true_false' : 'multiple_choice'

// The answer a draft question would be saved with: the marked choice, or the typed answer
export function answerOf(question) {
  if (isOpenResponse(question.choices)) return question.open_answer ?? ''
  return question.correctIndex === null || question.correctIndex === undefined
    ? ''
    : question.choices[question.correctIndex] ?? ''
}
