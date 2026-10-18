import type { Card, StudyDirection } from '$lib/types';

/**
 * A grammar Card's context is the whole rule note, not a short category, and
 * its example runs to several paragraphs ending in a [Note] tail. Shared by
 * the Study component browser specs so both exercise the same overflow.
 */
export const LONG_CONTEXT =
	'Chapter 01. Expressing Conjecture and Supposition · Rule: An adjective stem ends in a consonant, so the ending -나 보다 attaches to the stem after the past tense marker.';

export const LONG_EXAMPLE = [
	'날씨가 추운 걸 보니까 눈이 온 것 같아요. 어제는 하늘이 맑았는데 오늘 아침에는 길이 미끄러웠어요.',
	'',
	'친구가 밖을 보더니 코트를 꺼내 입었어요. 바람도 세게 불고 있었거든요.',
	'',
	'[Note] -나 보다 attaches to the stem and expresses an inference from what the speaker sees or hears.'
].join('\n');

/** The props of an overflowing grammar Flashcard in the given Study direction. */
export function longGrammarFlashCard(direction: StudyDirection = 'koreanToEnglish') {
	return {
		koreanWord: '눈이 온 것 같아요',
		englishWord: 'It seems to have snowed',
		context: LONG_CONTEXT,
		example: LONG_EXAMPLE,
		direction
	};
}

/** The same grammar Card as the backend serves it. */
export function longGrammarCard(overrides: Partial<Card> = {}): Card {
	return {
		id: 1,
		deckId: 10,
		koreanWord: '눈이 온 것 같아요',
		englishWord: 'It seems to have snowed',
		context: LONG_CONTEXT,
		example: LONG_EXAMPLE,
		...overrides
	};
}
