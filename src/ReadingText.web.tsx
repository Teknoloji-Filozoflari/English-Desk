import React from 'react';
import { tokenize, Token, Word, StoryNote } from './model';

export function ReadingText({ text, savedWords, savedNotes = [], selectedStart, onPick, fontSize = 22, lineHeight = 1.9 }: { text: string; savedWords: Word[]; savedNotes?: StoryNote[]; selectedStart?: number; onPick: (token: Token) => void; fontSize?: number; lineHeight?: number }) {
  const saved = new Map(savedWords.map(word => [word.word.toLocaleLowerCase('en'), word]));
  const noteRanges = savedNotes.flatMap(note => { const start = text.indexOf(note.selection); return start < 0 ? [] : [{ start, end: start + note.selection.length, note }]; });
  let offset = 0;
  return <div lang="en" style={{ fontFamily: 'Georgia, serif', fontSize, lineHeight, color: '#252B35', marginTop: 25, minWidth: 0, whiteSpace: 'normal', overflowWrap: 'normal', wordBreak: 'normal', hyphens: 'none' }}>
    <style>{`.reading-saved-word[data-meaning]:hover::after,.reading-saved-word[data-meaning]:focus-visible::after{content:attr(data-meaning);position:absolute;z-index:10;left:50%;bottom:calc(100% + 8px);transform:translateX(-50%);padding:7px 11px;border-radius:8px;background:#252B35;color:#fff;font:14px/1.35 system-ui,sans-serif;white-space:normal;width:max-content;max-width:min(300px,80vw);box-shadow:0 5px 18px #252B3540;pointer-events:none}`}</style>
    {text.split(/(\n\n+)/).map((part, index) => {
      const start = offset; offset += part.length;
      if (/^\n\n+$/.test(part)) return <div key={index} style={{ height: '1em' }} />;
      // Keep words and adjacent punctuation together; wrap only at whitespace.
      let cursor = start;
      return part.split(/(\s+)/).map((chunk, chunkIndex) => {
        const chunkStart = cursor; cursor += chunk.length;
        if (/^\s+$/.test(chunk)) return ' ';
        return <span key={`${index}-${chunkIndex}`} style={{ whiteSpace: 'nowrap' }}>{tokenize(chunk).map((token, tokenIndex) => {
          const absolute = { ...token, start: token.start + chunkStart, end: token.end + chunkStart };
          const savedWord = saved.get(token.text.toLocaleLowerCase('en'));
          const meaning = savedWord?.meaning.trim();
          const note = noteRanges.find(range => absolute.start < range.end && absolute.end > range.start)?.note;
          return token.isWord ? <span key={tokenIndex} role="button" tabIndex={0} className={savedWord ? 'reading-saved-word' : undefined} data-meaning={meaning || undefined} title={meaning || (note ? `${note.title}: ${note.body}` : undefined)} aria-label={meaning ? `${token.text}: ${meaning}` : note ? `${token.text}: ${note.title}` : `${token.text} kelimesini seç`} onClick={() => onPick(absolute)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onPick(absolute); } }} style={{ cursor: 'pointer', position: 'relative', borderRadius: 3, background: selectedStart === absolute.start ? '#F2DFAD' : savedWord ? '#F7E5DB' : note ? '#FFF0C9' : undefined, color: savedWord ? '#A84427' : undefined }}>{token.text}</span> : token.text;
        })}</span>;
      });
    })}
  </div>;
}
