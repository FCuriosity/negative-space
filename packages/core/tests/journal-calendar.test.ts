import { describe, it, expect } from 'vitest';
import { buildJournalCalendar, calendarWeekStart, recentCalendarDays, type JournalCalendarNode } from '../src/journal-calendar';
const tz='Asia/Shanghai';
const time=(day:string)=>Date.parse(`${day}T10:00:00+08:00`);
const events=(...days:string[])=>days.map((day,i)=>({id:String(i),at:time(day)}));
const tree=(days:string[],now:string)=>buildJournalCalendar(events(...days),e=>e.at,time(now),tz);
const leaves=<T>(nodes:JournalCalendarNode<T>[]):T[]=>nodes.flatMap(n=>n.children.length?leaves(n.children):n.items);
describe('calendar journal archives',()=>{
  it('keeps today expanded and folds yesterday without removing its records',()=>{
    const groups=tree(['2026-10-08','2026-10-07'],'2026-10-08');
    expect(groups[0].closed).toBe(false);
    const days=groups[0].children[0].children;
    expect(days.map(d=>[d.title,d.closed])).toEqual([['今天',false],['昨天',true]]);
    expect(leaves(groups)).toHaveLength(2);
  });
  it('closes a calendar week only when Monday begins, even if few days have records',()=>{
    const sunday=tree(['2026-10-11','2026-10-05'],'2026-10-11');
    expect(sunday[0].children[0].closed).toBe(false);
    const monday=tree(['2026-10-12','2026-10-11','2026-10-05'],'2026-10-12');
    expect(monday[0].children.map(w=>[w.start,w.end,w.closed])).toEqual([['2026-10-12','2026-10-18',false],['2026-10-05','2026-10-11',true]]);
  });
  it('archives a completed month and splits a crossing week without duplicating entries',()=>{
    const groups=tree(['2026-10-01','2026-09-30','2026-09-28','2026-09-27'],'2026-10-01');
    expect(groups.map(m=>[m.title,m.closed])).toEqual([['2026年10月',false],['2026年9月',true]]);
    expect(groups[0].children[0]).toMatchObject({start:'2026-10-01',end:'2026-10-04',closed:false});
    expect(groups[1].children[0]).toMatchObject({start:'2026-09-28',end:'2026-09-30',closed:true});
    expect(new Set(leaves(groups).map(e=>e.id)).size).toBe(4);
  });
  it('handles leap months and calendar weeks spanning New Year',()=>{
    const groups=tree(['2024-03-01','2024-02-29'],'2024-03-01');
    expect(groups[1].end).toBe('2024-02-29');
    expect(calendarWeekStart('2027-01-01')).toBe('2026-12-28');
    expect(tree(['2027-01-01','2026-12-31'],'2027-01-01')[1].closed).toBe(true);
  });
  it('uses the configured timezone at midnight, not the machine timezone',()=>{
    const rows=events('2026-10-07');
    const before=buildJournalCalendar(rows,e=>e.at,Date.parse('2026-10-07T15:59:59Z'),tz);
    const after=buildJournalCalendar(rows,e=>e.at,Date.parse('2026-10-07T16:00:00Z'),tz);
    expect(before[0].children[0].children[0].closed).toBe(false);
    expect(after[0].children[0].children[0]).toMatchObject({closed:true,title:'昨天'});
  });
  it('does not skip or duplicate calendar dates across daylight saving changes',()=>{
    const days=recentCalendarDays(Date.parse('2026-03-09T00:30:00-04:00'),'America/New_York',3);
    expect(days).toEqual(['2026-03-09','2026-03-08','2026-03-07']);
  });
  it('counts all records before UI pagination and keeps reverse chronology',()=>{
    const rows=Array.from({length:57},(_,id)=>({id,at:time('2026-10-07')+id*1000}));
    const groups=buildJournalCalendar(rows,r=>r.at,time('2026-10-08'),tz);
    expect(groups[0].items).toHaveLength(57);
    expect(leaves(groups).map(e=>e.id)).toEqual(rows.map(e=>e.id).reverse());
    expect(rows[0].id).toBe(0);
    expect(buildJournalCalendar([],r=>0,time('2026-10-08'),tz)).toEqual([]);
  });
});
