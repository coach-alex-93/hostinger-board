# Session Board

Session planner and periodization plan for the NCFC Youth U13 and U19 N1 South squads, fall 2026.

Static site. No build step, no server, no accounts. Three HTML pages, five scripts, one stylesheet.

---

## Deploy to Netlify

**Fastest route, about thirty seconds.**

1. Unzip this folder somewhere you can find it.
2. Go to `app.netlify.com/drop`.
3. Drag the **folder itself** (the one holding `index.html`) onto the drop zone.
4. Netlify returns a URL like `random-name-12345.netlify.app`. Rename it under Site configuration, Change site name.

That is the whole deploy. Nothing to configure. `netlify.toml` is already in the folder and sets the publish directory, cache headers and two short redirects (`/plan` and `/session`).

**If you would rather keep it in version control**, push the folder to a GitHub repo, then in Netlify choose Add new site, Import an existing project, pick the repo, and leave the build command blank with publish directory `.`. Every push then redeploys.

**To update it later**, drag the folder onto the same site's Deploys tab.

### Should it be public?

The URL is public but unguessable, and `robots.txt` blocks search engines. Nothing about the squads is on the server: the fixture list and the principle hierarchy ship as code, and everything you write stays in your own browser. If you want it locked down anyway, Netlify's free tier does not include password protection, but you can set one under Site configuration on a paid plan.

### Running it without deploying

Open `index.html` straight from disk. Everything works. The data files are plain JavaScript rather than JSON precisely so that `file://` does not trip over CORS.

---

## The twelve pages

**Season** (`index.html`) is the overview. One bar per day across the whole fall, per squad. Tall dark bars are games, green bars are training, and an amber outline means a session is written for that date. Underneath: what is next for both squads, and the sessions you have already written.

**Periodization** (`periodization.html`) is the plan itself. Every day from 3 August to 13 December, grouped by week, banded by block. Columns follow the exemplar workbook: day, date, GD, event, duration, physical load, moment, phase, principle, team focus, two player actions, notes.

Every field edits in place and saves as you type. Training rows carry a **Plan** button that opens the planner with date, squad and principle already filled.

- **Export CSV** produces the sheet in the exemplar's column order, ready to paste into the A3 workbook.
- **Back up everything** writes one JSON file holding every session and every plan edit. Do this before clearing browser history or moving to another device.
- **Restore backup** reads that file back.

**Session planner** (`planner.html`) is the session. Field-for-field it matches the IPM1 export, with the principle layer added on top.

**KPIs** (`kpi.html`) holds the KPI definitions and the field tally sheet.

**Review** (`review.html`) is the preview and review sheet for a session you have already written.

**Gallery observation** (`gallery.html`) is the sheet for watching someone else coach, or being watched.

---

## Gallery observation

Your IPM 1 gallery sheet, in its original two-column shape. Header block, then the design read on the left and the observation on the right.

**Left, teaching plan and interactions.** Seven tickboxes: Reality-Based, Experiential, Autonomy Support, Coaching Process, Progression, Complexity, Specificity. Then Evidence for why they were ticked, and the five context fields: session objective, activity objective, identified game situation and connected principle, connection to strategy and prioritized learning plan, instances identified.

**Right, the observation.** Three boxes from the sheet: the player behavior observed in those instances, how the coach interacted with and influenced it, and how the activity design influenced both the behavior and the coach's ability to affect it. Then a fourth that is not on the original, **what I am taking into my own coaching**, because that is the reason for watching in the first place and it is otherwise the thing you lose by Thursday.

A **Setting** field marks whether it was club or course, so the two are separable when you come to write them up.

---

## Timed coaching interventions

On the gallery sheet, and on your own session review. Same tool both places, so an intervention you log watching someone else records identically to one of yours.

**Start**, **Log an intervention**, **End session**, **Set clock**, **Reset to zero**. The clock counts in real time and keeps counting while you fill in rows, switch the linked session, or let the phone sleep, because it measures from a timestamp rather than counting ticks.

**Set clock** is for arriving late: type the real session time and the log stamps from there.

**End session** is not Pause. Pause means you are coming back; End means the session is over. It stops the clock, banks the length onto the sheet so it survives a reload and appears in print and in the export, and closes the sheet to further logging. The bar greys out and reads *session ended*. **Reopen session** undoes it if you ended early.

Ending while an intervention is still being timed closes that intervention first, so no length is lost.

Once a session has an end, the summary uses that as its span rather than guessing from the last intervention, which makes **ball rolling** an honest number instead of an underestimate.

**Reset to zero** clears the clock and the recorded length. Logged interventions stay.

Then the working rhythm is one big button, tapped twice.

**Tap when the coach steps in.** The row is created and stamped with the session time at that instant, and a second clock starts on the intervention itself, shown in amber next to the session time. The button changes to **Resume play**.

**Tap again when play restarts.** The intervention's length is written into the row in seconds. The button goes back to **Log an intervention**.

So you never type a time or a duration. Both are measured. Fill in who, when, how and the note afterwards, which is the only way this works live.

Three details worth knowing:

- If the session clock is not running when you tap, it **starts itself**, so you cannot accidentally log a session's worth of interventions against a stopped clock.
- While an intervention is being timed, Start, Set and Reset are disabled. There is one thing to do and one button to do it with.
- **Time it again** on any row restarts the length timer against that row, for when you tapped Resume too early.

Row lengths remain editable by hand, so a duration you recorded badly can be corrected without redoing it.

Per intervention:

| | |
|---|---|
| **When** in the session | Stamped from the clock, editable as `mm:ss` |
| **How long** it lasted | Shown and typed as **m:ss**. Measured for you by the second tap, and editable. A bare number is read as seconds, so `45` and `0:45` both work |
| **Who** | Whole team, a unit, a pair, a named player from the roster, or anyone else |
| **When** in the coaching sense | Introduction, during active play, planned stoppage, natural stoppage, pause to capture a moment. **Choose several** |
| **How** | Observe and adjust, positive reinforcement, direct feedback, demonstrate, guided question-answer, use of key words, drive-by coaching. **Choose several** |
| **Other** | Cold calling, group discussion. **Choose several** |
| **Where** | Click the mini pitch to drop a pin |
| **Note** | What was said or changed |

One intervention is rarely one thing. A planned stoppage that demonstrates and then asks a question is three marks, not a choice between them, so When, How and Other each take as many as apply. Selections show as small tags under the button; tap a tag to remove it.

The lists are the DataSheet's own, read through Lists, so you can extend them. Counting still works: an intervention tagged both planned stoppage and natural stoppage counts once toward the total and once under each type.

### What it counts

Six numbers, live: **session length** (or elapsed, before you end it), **interventions**, **per ten minutes**, **play stopped**, **ball rolling** (session span minus stopped play), and **different recipients**, plus who was coached most.

**How play stopped is worked out.** An intervention counts as stopping play unless it is tagged **During Active Play**, or marked as drive-by coaching with no other tag. Every timed intervention therefore starts contributing the moment you tap Resume, without waiting for you to tag it.

That is the opposite of how it was, and the change matters. Counting only rows already tagged as a stoppage meant the total sat at 0:00 through the session and only filled in later, which is exactly when you are least likely to go back and do it. Now the number is live and gets *more* accurate as you tag, rather than starting at zero and climbing.

Each row carries a badge showing which way it is counting, red **stopped 1:30** or green **in play 1:30**, so a row counting the wrong way is visible rather than buried in a total. The summary also says how many timed rows are still untagged.

Ball rolling time here is measured rather than planned, which makes it the honest counterpart to the Expt BRT you set in the plan. If a session was designed for 63 minutes of ball rolling and the log says 48, that gap is the finding.

That last pair is the uncomfortable one and the reason to bother. Three recipients across forty minutes means the same three players got coached and the rest were supervised. Four minutes of stopped play in a twenty-minute game is a fifth of the session spent not playing. Neither shows up in a written reflection; both show up here.

Pins on the mini pitch answer the same question spatially. Interventions clustered on one touchline usually means the coach stood there.

### Where it goes

On the review, the log auto-fills the occurred column for **coach's influence on player behavior**: the count, the span, the breakdown by type, and who was coached most. You then write the judgment yourself.

Both sheets print the log as a table underneath, sorted by time. Gallery export produces a second CSV, one row per intervention, with the pitch coordinates.

These are kept separate from the session review, because the coach observed is someone else in your club or on the course. Each sheet is its own record with its own date and its own observer, and you can hold as many as you like.

**If the session is one of yours**, link it and the five context fields fill from the plan: cycle objective and intentions, activity names and types, in-game scenario with the principle and cue, strategy and learning plan, instances to look for. Type over any of it and yours wins.

Print gives the sheet in the original two-column layout with the tickboxes rendered as ticked or empty. Export CSV gives every sheet you have written, one row each.

---

## The activity library

Every activity carries **Save to library** and **Insert**.

**Save to library** opens a small dialog: name it, tick **what it can be used for**, tag it, and choose whether the diagram goes with it. The moment the session is in is ticked already.

**Themes are a list, not a choice.** The same activity serves different topics depending on which side you are coaching in it: playing out from the back is pressing from the front, read from the other side. Tick every topic it works for and it appears under each.

Fifteen themes ship: the four moments, set plays, possession, finishing, pressing, defending the box, counter attack, warm-up and activation, physical, technical, goalkeeping and small-sided game. An editable list like any other.

Tags are searchable on top of the theme, so *rondo, pressing* finds it without remembering what you called it.

**Insert** opens the library and replaces this activity with the one you pick.

**Show each activity once** is on by default: a flat list, alphabetical, with the topics it serves as chips beside the name. Untick it and the list groups by theme instead, which repeats an activity under each topic it belongs to. That repetition is useful when you are hunting by topic and noise when you are not, so it is a toggle rather than a decision made for you.

### The library on its own

**Activity library** in the Setup block on the hub, badged with how many you have. Everything you have saved, grouped by theme, with buttons across the top to filter to one and a search box across names, tags, themes, types and descriptions.

**It reads as a shelf, not a document.** One line each: name, the numbers, the area, the timing, the type, and the themes it belongs to. Tap the name to open it, and only then do you see the objective, set-up, constraints, coaching points and diagram, with the theme tickboxes for changing what it counts as.

Editing the library does not touch sessions that already used the activity, and deleting from the library does not either.

An activity saved before themes existed falls under the moment it came from, so nothing is stranded in an unsorted pile, and ticking a new theme keeps that fallback rather than replacing it.

Export gives one row per activity with everything on it, with the themes in one semicolon-separated column.

Print gives a handbook grouped by theme with **each activity once**, under the first topic it serves, and the others named on the entry: *also for Pressing, Possession, Counter attack*. An activity that serves four topics appearing four times would not be a handbook.

The library is **not tied to a team or a season**. A rondo written for the U13s in October can go into a U19 session in March. Saved with it: the timing, the area, the numbers, the description, the constraints, the coaching points, the interactions and its diagram.

Filter by name, principle, moment, activity type or where it came from. Each entry says where it was first written, so you can tell the two rondos apart.

**Inserting makes a copy.** Editing it in this session does not change the library, and deleting it from the library does not touch sessions that already used it. The slot keeps its own place in the session, so a saved main activity dropped into the warm-up slot stays the warm-up.

---

## Universal objectives by game size

The A-Youth table is now attached to the **Number of players** field the activity already had, rather than living as a second dropdown saying the same thing.

Choose a size and the activity states what that size is for, and what it should look like:

| Size | What it is for |
|---|---|
| 1v1 | Be faster and more explosive, or perform more sprints and recover quicker |
| 2v2 | Play quicker and recover faster |
| 3v3 to 4v4 | Play quicker and recover faster |
| 5v5 to 7v7 | Play at a higher pace for longer |
| 8v8 to 11v11 | Outpace and outlast the competition |

Underneath, the intensity, duration, recovery, physiological stress, mechanical stress and action density that size implies. 1v1 carries a note that it does two different jobs depending on whether the recovery is maximal or minimal, which is the distinction the original table draws with two columns.

**It checks your numbers against it.** Set 3v3 with an eight-minute interval and it says so: *Off the shape: the interval is 8 min, this size wants about 1.5.* **Use the numbers this size wants** fills the interval and rest for you.

**The periodization grid carries it too.** A **Game size** column on each training row, with the objective underneath. A session written on that date inherits it into every activity, so the size is decided once in the plan rather than argued again in the session.

---

## Scouting: where, and who

**Thirds and channels.** Two segmented controls above the pads. Set them before a run of taps and every event carries where it happened. The per-team summary gains a strip showing the split by third, so 41 line-breaking passes becomes 6 in the defensive third and 28 in the middle.

**Key players.** Add the numbers you are watching, with a name if you know it, a position, and a line for where they start and where they end up. A row of buttons switches which player a tap is attributed to, or back to the team, and each one shows how many taps have landed on them.

**The clock counts now.** It was rebuilt on every press, which left the timer updating an element no longer on the page, so it appeared to move only when something else forced a redraw. Same bug the intervention log had, same fix: built once, one interval, never torn down.

---

## Formations onto any board

The tool rail has a **Formation** section. Pick a shape and **Place it on the pitch**: the keeper and each line arrive evenly spread and numbered. Shapes written in your game model appear first, then the common ones.

**Put it out** replaces that side and only that side. Change our shape and the opposition stays where it is; change theirs and ours is untouched. Anything you have drawn on top, lines, zones, labels, is never removed.

Every placed piece is tagged with the side it belongs to, which is how it knows what to clear. **Add without clearing** sits underneath for the times you want to layer two shapes deliberately.

A segmented control says whose shape it is: **Us** arrive blue coming up the pitch, **Opposition** arrive red coming down, already turned to face you. **Clear the pitch** removes everything, with a count and undo behind it.

On Team sheets the same pair exists against the fixture: **Put our XI out** carries the names and numbers off the sheet, **Put them out** places the shape you recorded for the opposition with their name across the top. Their shape and name are saved with the team sheet, so a season of sheets records what you faced as well as what you picked.

They are ordinary pieces once placed, so drag anyone out of line, turn them, resize them, delete them.

---

## An expectation, set before you watch

On Game analysis, above the action list: **what I expect to see**, what you are counting, and for which team. Then two counters, *happened at all* and *did what I expected*, and how many you expected.

The panel says whether the expectation was met, and there is a line for what actually decided it.

The order matters and the page says so: set the expectation before you play the clip. Counting what happened and then calling that the expectation is how a clip ends up confirming whatever you already believed.

---

## The IDP sheet is editable

Every criterion has a cross, every section header has **+ criterion**, and the toolbar has **+ Section** for a heading the club sheet does not have (set plays, goalkeeping distribution, whatever your team needs). What the club issued can be hidden; what you added can be deleted. A whole section of your own appears if you add criteria under a name that is not in the club sheet.

Marks already made against a hidden criterion are kept, and come back if you restore it. **Reset criteria** returns that position to what the club issued.

Edits are held per position, so adding a criterion to CB adds it for every centre back rather than for one player.

---

## Archiving a team, and starting the next season

**Archive** now says what goes with the season before it does it: *Everything on it goes with it: 34 sessions, 17 players, 12 team sheets, 46 edited days, 8 feedback polls, 5 cycles.* Nothing is deleted. Sessions on an archived season leave every list until it is restored, so last year stops appearing in this year's pickers.

**New season** copies a team forward. The roster, the coaches and the settings come across; the fixtures, sessions, marks and team sheets do not, because they belonged to last year. Players arrive with their names, numbers and positions and an empty depth ranking, which is roughly the state you want them in on the first day of pre-season.

---

## Scouting: counting a game, and what it becomes

The gap this closes is the one you named earlier: age-and-stage success criteria that come from watching games rather than from an opinion.

**Counting.** Set the game up, choose what you are counting from the same fifteen action types the tactics board uses, and tap. Two buttons per action: it came off, or it did not. A match clock stamps a minute against each tap, but it does not have to be running. A **who** switch flips between the two teams so you can count both. **Undo the last tap** for the inevitable misfire. Every tap saves.

Volume is why this is a separate tool from the tactics board. Classifying a moment there means drawing a line for it, which is right for a handful of significant actions and impossible for three hundred passes.

**This game.** Each action as a count, a per-90 rate and a success rate, per team. Per 90 matters because U13 games are 80 minutes: a raw total is not comparable between age groups, a rate is.

**Benchmarks.** Give a game a level, in your own words: *U15 ECNL*, *Courage Academy*, *N1 South*. Games at the same level aggregate into a benchmark: mean per 90, mean success rate, and the number of games behind it.

The count of games is shown deliberately. Under five it says **too few to lean on** and stays amber, because one game is a hint. At five it turns green. This is the honest version of "what does good look like at the level above".

**Make it a KPI target** writes the benchmark into a KPI, with where it came from in the description: *Benchmarked at 62% and 38 per 90, from 6 games scouted at U15 ECNL*. From there it flows into the session planner as a target, the field tally as a count, and the review as a gap. So a Saturday spent watching the level above ends up as a number on Tuesday's session plan.

---

## How the session landed

Four questions and a split on fatigue, asked of the players after a session, **in words rather than out of ten**:

| | Asked as | Answers |
|---|---|---|
| **Challenging** | How hard was that for you? | Too easy · A bit easy · Just right · Hard but I could do it · Too hard |
| **Improvement** | Did you get better at something? | Nothing new · A little · Something clicked · I got a lot better |
| **Fun** | Did you enjoy it? | Not really · It was okay · Good fun · Best session in ages |
| **Fatigue: body** | How does your body feel right now? | Fresh · A bit tired · Quite tired · Completely done |
| **Fatigue: brain** | How does your head feel right now? | Sharp · Thinking took effort · Hard to concentrate · Could not think straight |

Fatigue is split because they come apart: a technical session under time pressure can leave a thirteen-year-old mentally flat and physically fine, and the week after should treat those differently.

Answer for the squad as one, which is what a show of hands gives you, or record a single player. A value sits behind each label so a run of sessions can be compared, but nobody is ever asked for a number.

**Across sessions** shows each scale in date order against where you want it. Green is close, amber and red are off in either direction, because a session nobody found difficult is as much of a miss as one nobody could do.

**The Challenging target follows the session type**, rather than sitting at one number all season:

| Session type | Aim | Because |
|---|---|---|
| Threshold | 4.2 | a threshold day should feel hard |
| Organizational: Development | 3.6 | a development day should stretch them |
| Organizational: Review | 3.0 | a review day sits in the middle |
| Maintenance | 2.8 | a maintenance day should not be hard |

The panel says which applies while you are asking, and hovering a chip in the trend shows the type and target in force that day. The other four scales keep a fixed aim of 3.

---

## Smaller fixes

**An uploaded picture can be removed** from a diagram. Anything drawn on top of it is kept; only the photograph goes.

**Activities have their own objective field.** The review row called *Activity objective* was reporting the slot name, because no such field existed to report. Each activity now takes one, and the review reads it.

**The boxes are named zones on the tactics board.** An action ending inside the area reads *Penalty area* or *Goal area*, and at the other end *Own penalty area*, rather than being flattened into the attacking third. Entries read as *Middle third to Penalty area*, and Area is its own column in the export.

---

## Identity, style and cycle objectives are chosen, not typed

The identity box picks from **what influences the model**, which is now an editable list with an add button rather than a fixed paragraph.

Each moment in the style block picks from the style entries that already belong to it, with a count on the button: *Choose from the 30 entries in this moment*.

A **cycle objective** on the periodization page picks from the game model: every principle grouped by moment, every style entry grouped by moment, and the stock objectives. Seventy-five options across ten groups, all extendable, so a cycle is aimed at something that exists in the model rather than a phrase invented on the spot.

---

## Archiving a finished season

**Archive** on the Plans page takes a completed season out of the switchers without touching anything in it: the calendar, the sessions, the team sheets and the reviews are all still there. Tick **Show archived** to bring it back into the list, and **Restore** to return it to the switchers.

That matters at the end of a year. You want last season out of the way, not gone, because a review in August often needs a session from March.

---

## Every export offers a format

Downloads now ask. **Spreadsheet (.csv)** opens in Excel or Numbers. **Document (.html)** is a formatted table with a heading and banded rows, which opens in Word and saves as .docx from there. **Data (.json)** is for another tool or a re-import.

The same rows build all three, so nothing is lost by choosing one. The chooser says how many rows are about to leave.

---

## Smaller things

**A curved run is dashed**, matching every other run on the board; a curved pass stays solid. It was solid before, which made the two indistinguishable.

**Session methods take additions.** The method dropdown has an add button, and what you add joins the list for every session after.

**The page name is a menu.** The bar next to your initials is now a dropdown of every page, so you can go straight from the planner to the periodization grid without passing through the hub. It carries the team with it: the plan you were on stays selected.

---

## Formation diagrams

A formation in the game model draws itself. Type a shape and the pitch fills: keeper, then each line evenly spread, numbered back to front. **Draw it** opens the same board the planner uses if you want to move people off the even spacing, and **Back to the shape** throws your drawing away and returns to the automatic one. A small label says which you are looking at.

---

## Team sheets, minutes, and the week that follows

**On Team sheets.** Pick a fixture, pick a formation, name the starting XI and the substitutes, and set the on and off minute for anyone who did not play the whole game. **Put the XI on the pitch** places them in the shape with their numbers and first names, so a team sheet and a diagram are the same act.

The fixture picker reads the schedule, so it lists the real games with the opponent and whether you are home or away. Choosing one shows a fixture card: date, opponent, home or away, kick-off, venue, field and competition, with a link back to the schedule. The opposition name fills itself from the fixture. **A date with two games is two fixtures**, listed separately with their own kick-off times and opponents, each with its own team sheet. A player who played both is two appearances and their minutes add across the two, which is what the load bands need. The game length is read from the fixture, so a 2x20 preseason game sets 40 rather than 80.

Back on the schedule, a game row carries one link per game (G1, G2) showing how many are named and the shape recorded, and hovering tells you the player-minutes on the sheet.

Minutes are worked out rather than typed: a starter with no off minute played the full game; a substitute with no on minute did not play. The panel totals player-minutes and tells you what an eleven-a-side game of that length should come to, which catches a miscount.

**On the periodization page.** Game rows carry a **Team sheet** link showing how many are named. Underneath, minutes for the season per player: total, starts, appearances, and share of the minutes available.

### What the weekend asks of the week

The point of recording minutes is the training week that follows. Each player is banded by their share of the minutes available in the last game:

Banded on **minutes played**, not on a share of what was available. Seventy per cent of a two-game week is far more work than seventy per cent of a one-game week, so the share was measuring the wrong thing.

The window is the **last seven days**, not the last game. A weekend double-header and a midweek fixture land in the same total, which is the point: a player who played twice needs a different week from one who played once.

The thresholds **scale with how long that team's games are**, because half a game is 40 minutes at U13 and 45 at U19. Set **Game length** on the plan and the bands follow: under 37.5 per cent of a game needs volume, over 150 per cent needs managing. An 80 minute game gives 30 and 120; a 90 minute game gives 34 and 135.

Both numbers can be overridden per plan if you disagree with the ratios. The minutes panel says which thresholds are in force and links to where they are changed.

The thresholds are written down rather than buried in a colour, so you can disagree with them. What matters is that the squad stops being one group on a Tuesday: the player who played ninety minutes and the player who played none need opposite things, and the panel names both.

---

## Profiles live in the game model

The profiles editor is a section of the game model page now, not a page of its own. It sits under the principles, because what a position owes is written from them. Targets and the players in each position follow underneath. The old page is gone and every link points at the section.

---

## The team chip is the team switch

The chip in the header showing which squad you are on is now a dropdown when you have more than one plan. Change it and the page reloads on that team: the plan parameter follows, and any session id is dropped, because a session belongs to the team it was written for.

That was the gap. The chip told you which squad you were on but you still had to go somewhere else to change it, which is exactly when two teams get mixed up.

---

## The printed session, block by block

Full detail prints as one block per activity. Each block holds its own timing row, its words and **its diagram side by side**, and is kept whole so it never splits across a page edge.

Blocks are not forced onto separate sheets. Two short activities share a page; a long one with a diagram takes its own. That is the paper saving: the page break happens where the content runs out, not on a rule.

A diagram no activity claimed still prints, gathered at the end under **Other diagrams**, two to a row.

---

## Readiness reaches the periodization grid

The grid has a **Readiness** column. It reads the session written for that date and shows the score, green above 4.3, amber to 3.5, red below. Same arithmetic as the planner: the mean of the player means, present players only, absent and excused excluded. A red score next to a threshold load day adds *load may be high* underneath, which is the pairing worth seeing.

It exports too, so a block of dates carries its planned load and its measured readiness side by side.

---

## Cycles: what a block is for, and who it is aimed at

A **Cycles** panel on the periodization page, one entry per block. Each takes an objective and a list of players the cycle is aimed at, with each player showing how many IDP criteria they have starred.

That last number is the link you were missing. A cycle aimed at a player with nothing starred has nothing to move, and the panel says so: *1 in focus with nothing starred*, with a link straight to their sheet.

The planner picks it up: a session on a date inside a block inherits that block's cycle objective when the field is empty, so the objective is written once per cycle rather than retyped every Tuesday.

---

## Style of play, from your own document

Read out of : **48 style entries** and **20 influences**.

| Moment | Entries |
|---|---|
| Attacking Organization | 30 |
| Defensive Organization | 10 |
| Attacking Transition | 3 |
| Defensive Transition | 3 |
| Set plays | 2 |

Each is a heading and its wording, filterable by moment, and every one editable. Add your own, move one between moments, delete what has moved on.

**Check the wording.** The document is set in capitals, so the extraction had to convert to sentence case and re-capitalize the position codes. It reads correctly on the ones I checked, but 48 entries is more than I read closely, and the source carries its own typos (, , ) which are reproduced rather than silently corrected.

---

## What identity and style now do

They were a document. They are now present at the point of decision: the style statement for the moment you have chosen appears at the top of the learning design while you plan, with the identity line above it, and both print on the session plan. Change the moment and the note changes with it.

That is the whole mechanism. It does not constrain what you can write; it just stops the model being something you filed in August and never saw again.

---

## The hub, and an empty header

The header starts with nothing in it but your initials, where you are, and which team you are working on. The hub is the way around everything.

**Your initials** replace the crest, top left, and take you home. Change them under Setup.

**Where you are** sits next to them: the page name, then the team as a green chip. Hover it for the season dates and the head coach. On a page with no team chosen it says so rather than leaving you to guess, which is the point: two squads should never blur into one.

**Header shortcuts** under Setup lets you pin the pages you use daily into the header. Nothing is pinned to begin with. The page you are on always shows regardless.

---

## The game model as a section

The model is more than a list of principles, so the page now holds four parts.

**Identity and style of play** — the team in a sentence, then how you want to play in each of the four moments, with a count of how many principles sit in each.

**Formations** — a shape in and out of possession, when you use it, what it answers, and the roles that change. As many as you carry.

**Principles of play** — the editor: add, rename, re-code, move between moments, set phases, reorder, delete. Grouped by moment.

**What the model feeds** — links out to the profiles, vocabulary, KPIs and sequencing that are written from it, so the chain is visible rather than implied.

### Sub-principle numbering

A new sub-principle now continues the sequence. If IP1 runs to IP1.5 the next one is **IP1.6**, not a separate scheme. Letter-suffixed codes are counted by their number, so TR10 running to TR10.5 with letters underneath still gives TR10.6.

---

## Removing things

Anything that can be added can be removed, at three levels.

**A whole section.** The cross in a card header hides it. A bar at the top says how many are hidden with a **Show them** button.

**A single field.** Every labelled field carries a cross on hover. Hiding is per page and permanent, and a second bar reports the count with **Put them back**. Whatever was typed in a hidden field is kept, not deleted, so hiding is safe to undo.

**One entry in a list.** Every checkbox in every list has a cross: player actions, coaching interactions, sub-principles, the coach observation tickboxes, phases. This works on entries that shipped with the app, not only ones you added. Yours are deleted; shipped ones are hidden and come back with **Reset** on the Lists page. A confirmation says which is about to happen, and warns that it applies to every form using that list.

---

## The instance, the way the course defines it

The A-Youth material sets out a chain: **game model &rsaquo; principle &rsaquo; strategy &rsaquo; identified game situation &rsaquo; instance**. The plan now follows it in that order and says so, so the sequence is visible while you write rather than something you hold in your head.

**Identified game situation** is one sentence naming what happens now and why: *when we have opportunities to break the last line, we do not deliver the final pass because of the lack of runs*. The field says as much, because a paragraph here is a different tool from a sentence.

**Instance to identify** is its own section, and it is structured rather than free text. Name the instance, then write its **components**: the observable actions and conditions that, together, tell you the moment is present. There is no set number and no fixed list; the course is explicit that coaches name their own.

Each component carries two more things:

- a **filter**, which is context you apply to it. *Space is behind the backline* becomes *space is behind the backline, which is on or above halfway*. The filter sets how much of the component has to be there before the moment counts for these players.
- **if it is missing**, which is what you do to influence it to emerge. The course frames the coach's job as exactly this: when a criterion is absent, influence players to create it; when all are present, influence them to perceive, decide and act.

### Somewhere to start

Twelve instances ship, each with three components, filters and what to do when a component is missing.

The first four are the worked examples from the A-Youth material, kept as written so they read as the reference: the through ball behind the backline, the pass into the space between the lines, the first forward pass after the regain, and the arrival in the box on the delivery.

The other eight are written against this game model, one per principle it fits: receiving on the back foot between the lines (IP.1), the switch that arrives before the block shifts (IP.5), the third-man combination out of pressure (IP.7), regulating the tempo after a regain in our half (IP.8), the moment the press is triggered (OP.13), holding compactness as the ball travels (OP.14), denying the entry pass into the box (OP.17), and the counter-press in the first five seconds (TR.11). They are starting points rather than club material, and the library says which is which.

**Start from an example** loads one onto the session: the name, the components, and the identified game situation and strategy if you have not written your own. The example is untouched, so editing here changes nothing else.

**Keep this one** saves what you have written back to the library as yours. Your own appear first, marked as yours, and can be deleted.

**Check it** sits underneath with the four questions the course asks: is every component something you would see, if only one of them happened how do you respond, what is still missing, and would another coach agree the moment happened. It also counts what you have written and says when one component on its own is unlikely to be a moment.

The instance prints on both layouts and the review gains a row: **Did the instance appear?** The planned column lists the components with their filters; the occurred column asks which appeared together, which was missing, and what you did to make it emerge. That is the before, during and after the course describes, in one artifact.

---

## Condensed

Five things came out or moved, because they were saying the same thing twice.

**The player-facing cue lives on the principle only.** It used to be on the plan, on the principle and in the print, which is three places it could disagree with itself. It is now one field on the game model page, next to the principle it belongs to, which is where A2 defines it. All seventeen cues are intact and editable there.

**Anything else to look for is gone.** It sat at the bottom of the learning design doing badly what the instance section now does properly.

**The layers section is gone.** Where the ball is, how it gets there and what we do when it arrives were three boxes covering the same ground as the identified game situation and the strategy. Cycle objective and level of learning, which lived in that section, moved up into the learning design.

**Shape and specific roles moved into the learning design**, under a heading of its own. Shape in and out, the intention for each, the assignments by number and the key players are all part of designing the session, not a separate act.

**Desired behaviors are gone as a field.** They were the player actions written out longhand: ticking *adjust body to see field and next action* says the same thing as typing it. The block is now just **Player actions**, split offensive, defensive and transition, and what you tick is what the plan calls the desired behavior. The review and the export both read the ticks and group them by side, so the course sheet still gets a Desired Behaviors value without you writing one.

**Physical outcome and mindset focus are gone**, and so are their lists. Physical outcome overlapped with the training load and the game size, which already states the physiological and mechanical stress that size implies. The mindset framework was licensed material earning very little on a session plan.

The learning design now runs: the chain, what we want, how I will coach it, shape and specific roles, what it looks like. Then the instance as its own section, then success criteria, readiness and activities.

Everything that remains prints. Anything left empty is omitted rather than printed as a blank heading.

### An example for every principle

Eighteen instances now, fifty-four components, covering **all seventeen principles**. IP.1 to IP.9, TR.10 and TR.11, OP.12 to OP.17 all have at least one worked example to start from, so choosing a principle is never followed by a blank instance section.

---

## The session plan, restructured

**Layers are their own section**, alongside the cycle objective and the level of learning, so the three questions are asked deliberately rather than buried in a form.

**Where the bulk was.** The planner had accumulated several fields saying similar things in different words. Rather than delete fields your course template names, the learning design is now grouped under four honest headings that make the overlap visible: **The picture**, **What we want** (intentions and objectives overlap, keep the one you use), **How I will coach it** (strategy and learning plan also overlap), and **What it looks like**. Use the field crosses to strip whichever half you do not want.

**Layers instead of a list of instances.** Three boxes: where the ball is, how we get it where we want it, and what we do when it arrives. That is the order a session is actually coached in, and it stops "instances" collecting unrelated observations.

**Desired behaviors and player actions are one block.** They were two lists saying the same thing at different grain. The behavior now leads, and the actions sit underneath as the description of what it looks like when a player does it well.

**Shape and specific roles** is a new section: shape in and out of possession, the intention for each, and a box for the by-number detail (3 presses 7, 11 presses 2, 9 covers 6). The out-of-possession intention was the biggest gap: without it a session on wide play has no defensive picture to work against.

**Key players.** A number is enough, because a session on wide areas is about 7 and 11 whether or not you have named them. Add a position and it links to that role profile; add a name from the roster and it links to their IDP and KPI record.

**Level of learning.** Introducing, refining, challenging, competing, each with a note on what it changes. A concept that is new to a U13 is not new to a U19: same topic, different session.

**Coaching time inside an activity.** Tick your interactions and a suggested allowance appears, built from typical seconds per type (a planned stoppage is 90 seconds, a drive-by comment is 10) multiplied by the intervals. It shows as a share of the activity and what playing time is left, and turns red past 30 percent. Type over the suggestion whenever you know better.

**Sub-principles print in full.** They were printing as bare codes. They now print as their wording, in a two-column block of their own.

---

## Nothing is lost by navigating

Coming back to the planner reopens the session you were writing. It used to hand you a blank one, which made a working autosave look broken: the work was saved, you just could not see it. The tally sheet and the review land on the same session too.

**Age from date of birth.** The depth chart derives age, birth-year band and age group from the date of birth, on a season running 1 August to 31 July. A player born 14 September 2013 sits in the 2013-14 band and reads U14 for the 2026-27 season; one born 2 March 2014 is in the same band despite the later calendar year, which is the point of counting from August. Birth quarter derives from the same date. Nothing is typed twice.

**Coach observation** is what the gallery sheet is called now.

**Zones read as entries.** A line drawn on the tactics board records the third it started in and the third it ended in, so a pass from the middle into the final third shows as  rather than just where it landed. Actions inside one third read as *same third*. The by-zone breakdown counts entries, which is usually the question.


Every record-keeping page registers with an autosave. Work is written when you follow a link, when the tab hides, when the phone sleeps, when a field loses focus, and every twenty seconds while you are still typing. The top bar shows the time of the last save and whether it was automatic.

So clicking from the session planner through to the tally sheet no longer loses anything, and the two are connected because the session was saved before the browser moved. The old "save the session first" warnings are gone, because there is nothing left to warn about.

---

## Adding to a list is permanent

Additions used to be a mix: some joined the global list, some only lived on the record you were editing. Now everything you add joins the list for good and shows up in every future session.

- **Sub-principles.** *Add a sub-principle to IP.4* attaches it to that principle, so it appears whenever IP.4 is chosen. Yours carry a code like `IP4.m1` and a remove button; the ones from your hierarchy cannot be deleted by accident.
- **Player actions.** Each of the three columns has its own add button, and asks which group it joins.
- **Coaching interactions.** When, how and other each take additions on any activity.

Anything you added is distinguishable from what shipped, so the Lists page can show you what you have accumulated.

---

## Time as a percentage

Under the ribbon: **planned of allocated**, **ball rolling of allocated**, and **ball rolling of planned**, each with the raw minutes underneath.

The default four activities come to 91 minutes against a 75-minute session, which reads as 121 percent. That is the template's own arithmetic made visible rather than a fault: the numbers on your SessionTemplate sheet also over-run, and this is where you would notice.

---

## KPI targets as successes out of opportunities

A rate KPI now takes **successes wanted** and **out of opportunities** rather than a bare percentage. Eight of twenty reads better than forty percent and is easier to hold while coaching. The percentage is derived and shown next to it, and everything downstream, the tally sheet, the trend, the review, the export, uses the derived figure.

---

## Hiding sections

Every card on every page carries a small cross in its header. Hiding is per page and permanent, and a bar at the top says how many are hidden with a **Show them** button, so a section can never disappear without a trace.

---

## The pitch

Lighter grass, brighter lines, and drawn to a true 68 by 105. It was filling a near-square canvas, which squashed it. Markings now scale from the length actually shown, so the penalty box is right on the half and third views as well, not only on the full pitch.

Nothing moves: pieces keep their coordinates, so diagrams drawn before this change open exactly where you left them.

**Re-aiming a line** no longer means erasing it. Select any line, pass, run or dribble and the rail offers **15 degrees each way** and **Reverse**, which swaps the ends. Dragging either endpoint still works too.

---

## A note on iOS and dark mode

The site declares `color-scheme: only light`, in the stylesheet and as a meta tag on every page. Without it, iOS Safari in dark appearance restyles form controls with its own palette, which puts white text on the white inputs here and makes typed values look blank.

Every control also states its own colour and background rather than inheriting, including `-webkit-text-fill-color`, which iOS honours in preference to `color` on inputs.

Contrast is checked rather than assumed. Two values were failing and have been changed: placeholder text went from 2.96:1 to 4.68:1, and the amber used behind white text went from 3.41:1 to 4.65:1. Everything else sits at AA or better.

---

## Hiding tabs you are not using

The bar has ten tabs now, which is too many if you are only using three this week. **Tabs** at the end of the nav opens a list; untick anything to tidy it away.

Two things worth knowing. The page still works if you reach it by URL or by a link from elsewhere, so hiding is cosmetic rather than destructive. And the tab you are currently on always shows, so you can never strand yourself somewhere with no way back. **Show them all** puts everything back.

Season is always visible, since it is the way home.

---

## The three instruments, and what each one answers

They overlap in wording, so it is worth naming the question each one exists to answer. This is also the paragraph an assessor will want.

| Instrument | Question | Subject | When |
|---|---|---|---|
| **KPIs** | Are the players succeeding, and which ones? | The players | Counted during the session |
| **Session review** | Did what I planned actually happen, and where is the gap? | Your own plan and delivery | Written after the session |
| **Gallery observation** | What did another coach do, and what am I taking from it? | Another coach | Written while watching someone else |

The KPI is the measurement. The review complements it: when a KPI comes in under target, the review is where you work out whether that was a planning gap, a delivery gap, or simply a hard session against a good opponent. The gallery sheet sits outside both, because the coach being watched is someone else in the club or on the course.

---

## Success criteria and KPIs: where and when

The short answer to where this lives: **three places, in the order you actually work.**

| When | Where | What |
|---|---|---|
| Once, up front | KPIs page | Define the KPI: category, description, which principle it belongs to, and how it is measured |
| Writing the plan | Planner, **Success criteria** | Pick one or two, set the target. This is what makes a success criterion rather than a hope |
| At the field | KPIs page, **Tally sheet** | Two big buttons per KPI, opportunity and success. Every tap saves |
| Afterwards | Review | The result appears already filled in the occurred column, against the target you set |

### Defining a KPI

Your analysis sheet counts opportunity against success and reports a rate, with a separate column for the IDP player. That shape is what is built here.

A KPI has a category, a description saying what counts as an opportunity and what counts as a success, an optional principle, and one of three measures: **success rate** (successes out of opportunities), **count of successes**, or **count of opportunities**. That last one matters more than it looks: sometimes the honest question is whether the situation appeared at all.

**Start from your principles** creates one KPI per principle in a single click, using the principle's own teaching line and cue as the description. Nothing is invented; it is your wording. Then delete down to the few you will really count.

### Setting the target

In the planner, the picker offers KPIs for the session's principle first, everything else underneath. Set a number and that is your success criterion: 40 percent, or eight successes, or twelve opportunities. Until a target is set the app calls it "no target" rather than pretending.

One or two is the right number. A KPI you cannot honestly count while coaching is not a KPI.

### Tallying, and who is succeeding

The tally sheet is built for a phone at the side of a pitch: 66 pixel buttons, no typing, and it saves on every tap. Two rows per KPI, opportunity and success, plus minus buttons for the miscount. Marking a success also bumps opportunity if you had not, because a success is by definition an opportunity.

Set **Attribute to** before you tap and the count lands on the team and on that player. Under each KPI, **Who is succeeding** ranks every player counted, showing successes out of opportunities and the rate, so the answer to "which players" is on screen while you are still at the field.

**Who is succeeding** as a section aggregates the same thing across every session on the squad: each player's total against each KPI, with a note flagging anyone under four opportunities, because a player with two attempts has a number rather than a finding.

The team trend sits underneath as context. It is deliberately the smaller of the two now: a squad rate of 38 percent tells you less than knowing which four players are carrying it.

CSV export carries a TEAM row for each KPI in each session, then a row per player with their share of the team's opportunities, which is the shape of the IDP column on your performance analysis sheet.

### Closing the loop

The review gained a **Success criteria** row in the training context block. Its planned column reads the targets you set; its occurred column arrives pre-filled with what the tally recorded, whether the target was met, and your note. You still make the alignment call yourself.

**Across sessions** on the KPIs page lays every tally out in date order, green where the target was met, red where it was not, and for rate KPIs says how many points it has moved across the run. That is the number that answers whether the block worked.

Export CSV gives every tally across every session in the column shape of your performance analysis sheet.

**IDP** (`idp.html`) is one development sheet per player, built from the criteria in your EVB workbook.

---

## Session review

Your IPM 1 sheet, laid out the same way: Identify (preview) → Respond (session) → Measure (review). Header block, then three sections, each running Planned, Occurred, Alignment and gaps, Evidence.

| Section | Elements |
|---|---|
| Training context | Session objective · Activity objective · Identified game situation and connected principle · Connection to strategy and prioritized learning plan · Instances identified |
| Player behavior | Expected against observed |
| Coach's influence | Intended coaching interactions against actual |
| Competency focus | One box for the development period |

**The planned column fills itself.** It is derived from the session, not copied into it, so if you change the plan the preview follows rather than going stale:

| Row | Comes from |
|---|---|
| Session objective | Cycle objective and team intentions |
| Activity objective | Each activity's name, type and first description line |
| Game situation and principle | In-game scenario, the principle, the cue, the sub-principles ticked |
| Strategy and learning plan | Strategy, learning plan, training objectives |
| Instances | Instances to look for |
| Expected player behavior | Desired behaviors and the player actions selected |
| Intended coaching interactions | Each activity's when, how, other and key coaching points |

If you want different wording on a row, **Edit wording** pins your own text and a Reset puts it back on the plan.

The only typing is what actually happened. Each row also takes a **call**: aligned, partial or diverged, on the same traffic light as the IDP sheets.

### Why the call matters

**Across your reviews** counts the calls by element across every session you have reviewed. One diverged row is a session. The same row diverging four times is a coaching problem, and the panel says so once it has seen it twice, naming the element and suggesting you carry it into your competency focus.

That is the part that makes this deliberate rather than administrative: the sheet on its own records a session, the aggregate tells you what to work on.

**Competency focus carries forward.** A new review starts with whatever you wrote on your last one, so it stays a single thread from IPM 1 to IPM 2 rather than restarting each Tuesday.

### Getting to it

- **Review** in the top nav, then pick a session.
- **Review** on the planner toolbar, which opens the review for the session you have open. It asks you to save first if there are unsaved changes.
- On the periodization grid, every training row with a written session carries a small **review** chip, green once a review exists.

Reviews are stored on the session itself, so they travel with JSON export and into the published library. Print gives you the sheet in the original layout, one session per page. Export CSV gives every review across every session, one row per element, for pulling into an assignment.

A library session is read-only, so writing a review against one copies it into your own sessions first and tells you it has.

**Depth chart** (`depth.html`) ranks the squad by position, laid out as a formation.

**Lists** (`lists.html`) is where every dropdown in the app gets its options.

**Profiles** (`profiles.html`) is what each position is responsible for, from your game model.

**Tactics board** (`board.html`) is the drawing board on its own page, for video review.

**Plans** (`plans.html`) is where the calendars live. See below.

---

## Role profiles, and how they reach a session

Read from the roles and responsibilities grid in `Alex_Edwards_Game_Model_Development`: seven positions, each with what it owes in all four moments. GK 8 responsibilities, CB 8, OB 9, CDM 8, AM 10, WF 12, CF 12.

**One thing to check.** The striker's grid runs across a page break in the source, so its transition rows are inferred from the continuation page. CF carries a flag saying so. Everything else parsed cleanly, though the source has a few typos (`posession`, `atatcking`, `Iniciate`) which are reproduced as written rather than silently corrected. Fix them here and they are fixed.

**Everything is editable.** Every responsibility is a text box. Reorder with the arrows, delete, or add. Add a whole position if you run something the game model does not name. **Reset to the game model** puts the original back; your targets and KPIs survive it.

Three buttons on each responsibility turn it into work:

- **Target** marks it as something you are actively coaching. Targets collect underneath with the date you set them, and the row turns amber.
- **KPI** creates a KPI from that responsibility, pre-described with position, moment and the wording, and linked back to it. Set the number on a session as usual.
- **Session** opens the planner with that responsibility as the team focus.

So the chain runs: the game model says an outside back should press the winger as the ball travels → you mark it a target → you attach a KPI → you set 40 percent on Tuesday's session → you tally it at the field → the review tells you whether the gap was planning or delivery → the trend says whether the block moved it.

Underneath, **players in this position** lists everyone whose primary, secondary or covering position matches, with their IDP focus count.

---

## Cancelling, and sessions someone else took

**Cancel** now sits as a button on every training row, asking for the reason in one step. Cancelled rows carry a **Restore** button.

Separately, **Delivered by** on each training and game row: Me, or someone else. Choosing someone else asks who and why you were away (course, work, illness, family, other club duty). The row tints and the counts split: **Training days** is what the squad had, **You delivered** is what you took.

That distinction matters for A4. A session someone else delivered is not one of your applied coaching cycles, and the two numbers being different on the page is better than remembering it in November.

---

## Tactics board and match analysis

The planner's board on its own page, with the same tool rail, for working through video.

### Facing: one dial, any angle

The eight-way grid, the separate turn button and the fixed 45-degree steps are all gone, replaced by a ring with a ball on it.

Drag the ball round the ring and the piece turns with it, live, at **any angle** rather than in eighths. It settles onto the eighths when you get close, so square shapes stay square without fighting you. The reading underneath shows the angle, and the middle of the dial clears the facing.

With nothing selected it sets which way the next piece will face. Select a piece and the same dial turns that piece, with the heading changing to say so. A piece placed hours ago turns as freely as one just put down.

Lines keep their own controls, because swinging a line is a different gesture: **15 degrees each way** and **Reverse**.

**Old diagrams are safe.** Facing used to be an index from 0 to 7. It is now stored as an angle, with the old index kept in step alongside it, so anything drawn before this opens unchanged and a clean eighth stores no extra data at all.

### Piece size

Pieces were one fixed size, which is too big on a full pitch and too small in a twenty-yard grid.

**Piece size** in the rail sets every piece on the board: XS, S, M, L, XL. It is stored with the board, so a full-pitch diagram at S and a small-sided one at L both reopen the way you left them. M is the old size, so nothing you have already drawn changes.

Any single piece can differ. Select it and **+ bigger** / **− smaller** adjusts that one, between 0.4 and 3 times the board size. Useful for making the ball or a target player obvious without inflating everything.

Line thickness, arrowheads, dashes, shirt numbers and text all scale with the piece, and so does the area you have to tap to select something, so small pieces stay reachable.

### Drawing on a clip

**Draw on a clip** on the board page opens a local video player. Pick a file from the device, scrub or step frame by frame, then **Freeze this frame onto the board**. The still becomes the board background and every existing tool draws over it: passes, runs, zones, labels, and the action classification with its outcomes.

The timestamp fills itself from where you froze, so a board made at 34.2 seconds says so.

**Nothing is uploaded.** The file is read with an object URL and played on the device. It never reaches Netlify or anywhere else, which matters because these are clips of minors.

**What is saved is the frozen frame and your marks**, not the video. The clip is too large for browser storage, so it has to be re-picked if you want to scrub again, but the board itself stays readable forever: a still with the movement drawn on it and the analysis attached. **Save as PNG** exports the frame and the drawing together at double resolution.

A frozen frame is stored as a JPEG at about 900 pixels wide, roughly 60 to 120 KB. Browser storage runs to about 5 MB, so keep an eye on the count if you are freezing dozens; **Back up everything** on the periodization page exports them all.

**Back to the pitch** returns the board to a normal diagram, and the frame is kept in case you switch back.

### Actions with outcomes

Every line you draw is a candidate action. Classify it underneath and the line recolours: **green for a success, red for a failure**, with a tick or cross at the arrow head. Nothing you leave unclassified changes colour.

Fifteen action types, each with its own outcomes, and each outcome already marked as success or not:

| Action | Outcomes |
|---|---|
| Pass, Switch, Line-breaking pass | Complete · Incomplete · Intercepted · Out of play |
| Cross | Complete · Cleared · Blocked · Out of play |
| Dribble | Beat opponent · Dispossessed · Fouled · Forced backward |
| Carry | Progressed · Dispossessed · Forced backward |
| **Shot** | **Goal · On target, saved · Off target · Blocked · Hit the frame** |
| Run off the ball | Found · Not found · Offside |
| Press | Won the ball · Forced backward · Beaten · Foul |
| Tackle | Won · Lost · Foul |
| Interception | Made · Missed |
| Clearance | Effective · Straight back to them · Out of play |
| Aerial duel, Recovery | Won · Lost |
| Save | Held · Parried to safety · Parried to danger · Conceded |

A dribble that draws a foul counts as a success; forced backward does not. A shot on target that is saved counts; blocked does not. Those calls are in the data, so change them if you disagree.

Each action also takes a **player** from the roster, a **principle** from your seventeen, and a **zone** derived from where the line ends: nine zones, thirds by channel, attacking upward.

### What it totals

Marks drawn, classified, successful, and a success rate, then bars by **action**, by **player** and by **zone**. So a clip run gives you passing 8 of 11 in the middle third, shots 1 of 4, and which player is losing it where.

**Send a type to KPIs** turns any action type into a KPI with the success definition already written in, so a board finding becomes something you set a target on and count at the field.

**Export actions** writes one row per classified action across every board, with clip, timestamp, player, principle and zone, for pulling into an analysis document.

### The rest of the board

Alongside the drawing: title, date, squad, **video or clip link**, **timestamp**, opponent or session, moment, phase, principle, notes, and a verdict from **Model executed** / **Model attempted, execution failed** / **Model not recognized** / **Model wrong for the picture** / **Good outcome, off model**.

That last list is the useful part. Drawing a moment tells you what happened; the verdict tells you whether the model or the execution was at fault, which is a different conversation with the player and a different session on Tuesday.

Boards save with a name and a timestamp, so a clip at 34:12 is findable again. **Save as PNG** exports at double resolution for a slide or a team meeting. **Duplicate** is for drawing the same moment as it was and as it should have been.

---

## Lists: adding and removing options

Every dropdown reads through one layer, and that layer is editable. Twenty-one lists, grouped by where they are used.

Add an entry and it appears in the dropdown immediately. Remove one and it disappears, but a **shipped entry is hidden rather than deleted**, so Reset always brings the club's vocabulary back. Anything you added yourself is deleted outright. Hidden entries sit in their own section at the bottom with a Restore button, so nothing vanishes without a trail.

Export and Import move your list edits between browsers as a single file.

Three lists are seeded from elsewhere rather than typed out: **cues** come from the 25 principle cues, **instances to look for** from the 70 coaching points, and **desired behaviors** from the 64 player actions. Three start empty because only you have the material: **cycle objectives**, **in-game scenarios** and **learning plans**. Add as you go and they build up.

### Every list field opens the same checklist

Cycle objective, in-game scenario, strategy, learning plan, instances to look for, desired behaviors, physical outcome, mindset focus, team intentions, training objectives, **activity constraints** and **key coaching points**.

Each opens a checklist rather than a dropdown: filter, tick as many as apply, **Add selected**, and they arrive as separate lines appended to whatever you already wrote. A dropdown that adds one thing at a time is slow when you want four.

Every checklist also has a **Not there?** box at the bottom: type your own, and it is both inserted and added to the list for next time, so the vocabulary grows as you use it.

The player-facing cue is the one exception: it replaces rather than appends, because a session has one cue.

Four lists shipped empty and now have starters: cycle objectives (10), in-game scenarios (12), learning plans (10) and activity constraints (18). **These are written for this app, not lifted from your documents**, unlike the DataSheet vocabulary. They are there so the pickers are usable on day one. Edit or delete them on the Lists page.

**Mindset focus** is now the eleven tools from the Abrahams deck, not eight. The deck lists: be an influencer, develop your self-skills, get your coach head on, reflect in-action, warm them up mentally, structure leadership, huddle them up, have learning zones, have tools to build confidence, promote HPM, and help them develop a match script and game face.

**Sub-principles** stay checkboxes rather than a dropdown, because a session normally works more than one and a dropdown would only let you pick one. They are driven by the principle you choose.

### Desired behaviors and player actions

You are right that they overlap, and mostly they are the same vocabulary at two levels. A **player action** names what the player does. A **desired behavior** is what you expect to see when she does it well, which is what you actually observe and record. Rather than pretend they are separate lists, the desired behaviors picker draws from the player actions, so you can pull the action in and then write the observable form of it. If you would rather they were one field, say so and I will merge them.

### Phase

Phase was empty until a moment was chosen, which read as broken. Fixed in the planner and on the periodization grid. It now offers all ten phases prefixed by their moment when nothing is selected, and choosing one sets the moment for you. Choose a moment first and it narrows as before.

### Area of the field

Split in two: **area** (defensive third, middle third, attacking third, full field) and **channel** (central, wide left, wide right, wide both, half-space, full width). Both are editable lists, so attacking third plus wide right is now expressible.

**Principle reference** is gone from the learning design panel.

---

## Where sessions live, and how they reach a second device

Two tiers, because a static site has no server to write to.

**Your sessions** live in this browser. Editable, saved as you work, private to that device.

**The library** ships inside the deployment, in `js/data.sessions.js`. Library sessions are read-only and appear on every device that opens the site, phone included. Opening one and saving makes an editable copy in whichever browser you are on; the library copy is untouched.

To move sessions from your laptop into the library:

1. Planner, **Publish library file**. It builds `data.sessions.js` from everything saved in that browser, and folds in whatever is already in the library.
2. Drop the file into `js/`, replacing the one there.
3. Redeploy.

That is as internal as a drag-and-drop Netlify site gets. Real shared storage that writes back would need a serverless function and a build step, which would cost you the thirty-second deploy. Say the word if that trade is worth making.

---

## Depth chart

One card per position, laid out as a formation, matching the columns on your club chart: rank, player, birth quarter, age group, and the positions she covers.

The roster is shared with the IDP sheets, so a player added in one place appears in the other. Her birth quarter comes from her date of birth on the club's legend. You set her **age group**, and every position she can **also cover** beyond her primary and secondary. She then appears in each of those position cards and carries a separate rank in each, so first choice at CB and third at OB is expressible.

Arrows reorder within a position. Cards go amber at one deep and red at empty, which is the point of the exercise: it puts GK on the U19 chart in red until you have one, and shows at a glance which conversions are load-bearing.

Totals count birth quarters, which is where relative age shows up, and list every position that is one deep or empty.

Names live in this browser only, alongside everything else, and never leave it unless you export.

---

## What comes from the yearly planner

The controlled vocabulary is lifted from the DataSheet of `U13 N1 Yearly Session Planner 2026-27`, so the dropdowns are the club's own words rather than anything invented here:

| List | Count |
|---|---|
| Moments, as moment and phase in one | 8 |
| Training load, 0 to 10 RPE | 7 bands |
| Activity types | 10 |
| Session methods | 5 |
| Player actions, in twelve groups | 64 |
| Coaching interactions, when / how / other | 5 / 7 / 2 |
| Team intentions, by phase | 70 |
| Training objectives, by phase | 70 |
| Coaching points, by phase | 70 |
| Fields | 33 |
| Areas of the field | 5 |
| Attendance states | 4 |

**The Player Names column is deliberately not read.** It holds a real roster.

Team intentions and training objectives each have a picker underneath the box: choosing one appends it as a line rather than replacing what you wrote, so you can mix the club's language with your own.

---

## Cognitive load on a scale

It was Low / Moderate / High, which is too coarse to periodize against. It is now 0 to 10, mirroring the RPE scale the club already uses for physical load, with a descriptor on each step: 0 automatic and no decisions, 4 reading one opponent, 7 live opposition in real time, 10 full game with scoreboard pressure.

Two scales on the same 0 to 10 range means you can plot them against each other across a block, which is where the interesting question sits: whether your high cognitive days are landing on your low physical days.

---

## Player readiness

Polled per player. Each player on the plan gets a row: attendance, then sleep, soreness, energy, stress and mood scored 1 to 5.

**How the average works.** Only players marked Present or Present-Late count. For each of those, their answered questions are averaged into a player mean; the gate score is then the mean of those player means. That way a player who answered three of five questions still counts once rather than counting less, and an absent or excused player cannot drag the number down. The panel states the arithmetic underneath: how many players were counted, out of how many present, out of the squad.

If there is no roster on the plan, or you press **Squad average only**, it falls back to five sliders for one squad-level reading.

The score drives a gate:

| Score | Gate | Suggested |
|---|---|---|
| 4.3 and up | Green | Run the session as planned |
| 3.5 to 4.3 | Amber | Hold the plan, trim one interval from the highest-load activity |
| 2.6 to 3.5 | Orange | Drop the load band one step, cut intervals by about a quarter |
| below 2.6 | Red | Reduce to recovery: lower intensity, shorter intervals, more rest |

It reads your planned ball rolling time and tells you what a quarter off it would look like in minutes. **Nothing changes on its own.** The gate is advisory and the numbers stay yours to override. Until you move a slider it reads Not polled rather than guessing.

---

## A diagram per activity

Each activity owns its own diagram. The card carries a live thumbnail; clicking it or the button opens the board on that diagram and scrolls to it. Draw, and the thumbnail updates. A new session opens with four diagrams already created, one per slot, and the board tabs are named after the activities rather than numbered.

---

## The 17 principles

Your session planner document lists seventeen principles, and the app was showing twenty-five. The difference was TR10 and TR11: your hierarchy writes out `TR10.1` to `TR10.5` and `TR11.1` to `TR11.5` as separate headings, but the DataSheet treats `[TR.10]` and `[TR.11]` as one principle each.

The document wins. TR10 and TR11 are now single principles with those ten entries folded in as their sub-principles, which gives seventeen at the top level, in the DataSheet's order.

Dropdowns read the document's wording: `[IP.6] Penetrate | Break Lines`, not `IP6 Penetrate and Break Lines`. Where your own name differs it appears above the sub-principles, and the print sheet carries both. Ten of the seventeen differ, mostly in capitalization and bracket style.

---

## Creating a team without leaving the session

The plan dropdown on the planner ends with **+ New team**. Name, season dates and minutes per training day, and it exists: a calendar you can sequence and write against straight away. Fixtures and blocks come later on the Plans page, or never, if the team does not need them.

---

## Printing a session on one page

The **Print / PDF** button now has a layout next to it.

**One page** is landscape Letter, everything on a single sheet: a header strip with squad, date, coach, location, block, GD, duration and ball rolling time; a band of six for principle, moment and phase, cue, method, training load and cognitive load; three panels for sub-principles, intentions and objectives, and player actions grouped by side of the ball; then the four activities as columns, each with its timing table, set-up, actions, constraints, coaching points, interactions and its diagram; and a footer of instances, desired behaviors and success criteria.

Text is clamped rather than allowed to run, because a one-page plan that spills to two pages is not a one-page plan. Long entries are cut with an ellipsis. If something matters and keeps getting cut, shorten it in the plan or print full detail.

**Full detail** is the previous layout: portrait, one block per activity, nothing truncated, usually three or four pages.

The page size and orientation switch with the layout, so you do not have to remember to change it in the print dialog.

---

## Offensive and defensive actions

The club list is twelve groups in one long scroll, which is hard to use when a session is built on one side of the ball. It is now three columns: **Offensive** (33 actions across receiving, passing, dribbling, ball striking, crossing and movement), **Defensive** (18 across pressure and cover, recovery and tracking, and aerial duels), and **Transition** (13 across both directions).

Each column carries a count of what you have selected, so you can see at a glance that a session has three offensive actions and nothing defensive. Nothing was renamed or reordered inside the groups; only the presentation changed. The same split is used in print and in the review, where actions are listed under their side rather than as one run-on line.

---

## Sub-principles are intent, not a record

They were labelled "sub-principles worked", which reads as a report on a session that has already happened. In the plan they are **sub-principles to work on**: chosen before you deliver, as the thing you are trying to get to.

What actually got worked is a separate question and now has its own row in the review, **Sub-principles: intended, then worked**. The planned column lists what you targeted; the occurred column is where you say which of them got worked and which did not, with the usual aligned, partial or diverged call.

That distinction is the whole point of doing both documents. Targeting four sub-principles and working two is a normal session. Targeting four and working none, three weeks running, is a planning problem.

---

## Player actions are not principles

Worth stating plainly, because the two lists overlap in wording and it is easy to conclude the model is wrong.

Every code in your hierarchy (IP1 to IP9, OP12 to OP17, TR10.x, TR11.x) is a **team** statement. None of them is a player action. The club's twelve player actions sit on a different axis entirely: they name the individual execution a sub-principle demands. So the app treats them as a tag, not an alternative, and you set both.

Where the two genuinely collide is one level down. Fifteen of your sub-principles are already written as an individual action rather than a collective arrangement, and the planner flags each one with the action it reads as, next to the checkbox:

`IP1.4` `IP4.1` `IP5.2` `IP6.1` `IP6.3` `IP7.1` `IP9.3` `OP16.4` `OP17.1` `OP17.2` `TR10.3a` `TR10.3c` `TR10.3d` `TR11.2a` `TR11.3a`

Nothing is rewritten on your behalf. The flag is there so you can decide whether each one belongs at sub-principle level or should move down to the solution level with the action carrying it. Tick sub-principles and the suggested actions appear under the player action dropdowns.

---

## IDP sheets

One sheet per player, driven by position. Add a player, set a position, and the criteria load: nine universal criteria that apply to everyone, then the positional set.

| Position | Criteria | Source |
|---|---|---|
| GK Goalkeeper | 18 | Built from your role profile |
| CB Center Back | 28 | EVB |
| OB Outside Back | 31 | EVB |
| CDM Center Defensive Midfielder | 30 | EVB |
| AM Attacking Midfielder | 29 | EVB |
| WF Wide Forward | 31 | EVB |
| CF Center Forward | 30 | EVB |

Positions are labelled to your register, not to the EVB tab names: `FB` is loaded as `OB`, `#6` as `CDM`, `#10` as `AM`, `Winger` as `WF`, `#9` as `CF`.

**The EVB workbook has no goalkeeper sheet.** Rather than leave a hole or quietly invent one, GK is built from the role profile you already wrote and is labelled as such in the sheet header, on screen and in every export. It is the one position where the criteria are not club-issued.

**Review windows are yours.** The EVB workbook runs March, June, September, November. That does not fit an August-to-December assignment cycle, so the windows default to the blocks on the current plan and are renamable and redatable under **Review windows**. Up to five.

Each player carries a **date of birth**, from which the birth quarter derives on the club's legend (Q1 Aug-Oct, Q2 Nov-Jan, Q3 Feb-Apr, Q4 May-Jul), plus a **primary** and a **secondary** position. Both feed the depth chart automatically.

Against each criterion, per window, two controls:

- **A star.** Filled amber means this criterion is an IDP focus for that window. That is where focus is set, one star per criterion per window. Coverage counts the stars.
- **Three lights.** Red, amber, green, mapping to Foundation, Developing and Advanced. Click one to set it, click it again to clear. Exports still carry the tier names, so nothing downstream changes.

### Trending right now

A **Trend** column compares the first and last window carrying a rating and shows the direction: up 2, holding, down 1. Two ratings are needed before a direction is claimed; one rating shows a dot, because a single reading is a position, not a trend.

Above the sheet, a **Trending right now** panel summarizes the player: what is Advanced today, what is moving up, what is moving down. It fills in as soon as any criterion has been rated in two windows.

Export as CSV, or print one page per player.

Player names live in this browser only, alongside everything else. They are never sent anywhere.

---

## Cancelled sessions

Set the event to **Training Cancelled** and a reason appears next to it: weather, field unavailable, numbers too low, coach away, club event, school conflict, other.

A cancelled day is struck through on the grid, hatched red on the ribbon, drops out of the training-day count into a separate **Cancelled** figure, and stops counting toward principle coverage. The row keeps whatever you had sequenced against it, so you can see what you lost rather than having it silently vanish. **Game Cancelled** behaves the same way.

---

## Using it as a template

Nothing here is welded to fall 2026. A **plan** is just a calendar config: a date range, the days you train and how long for, optional blocks, optional fixtures. The two fall squads ship built in, and anything you create sits alongside them in the same selector on every page.

### Starting a blank plan

Plans, then **Start a blank plan**. Name it, set the dates, put minutes against the days you train, and save. That is the minimum. You now have an empty periodization grid with the same columns, the same principle picker and the same link into the session planner.

Optional from there:

- **Blocks.** Add them by hand, or press **Split the season into four** and drag the dates around. A plan with no blocks runs as one continuous stretch.
- **Fixtures.** Import a CSV in the same column shape as the NCFC schedule file (Date, Team, Home/Away, Opponent, Location, Field, Kickoff, Notes). If the file covers more than one team it asks which one you want. Dates read as `12-Sep`, `2026-09-12` or `9/12/2026`. You can also just switch a row to Game HOME on the grid and type the opponent into notes.
- **Preview the calendar** before saving, to check the training days and counts came out right.

Once fixtures exist, GD numbering and the default load bands appear on their own. With no fixtures the GD column stays blank, which is correct rather than broken.

### Copying an existing plan

**Duplicate** on any plan, including the built-in ones, makes an editable copy with the fixtures carried across. That is the quick route to next season: duplicate, shift the dates, reimport the fixture list.

### Handing a plan to someone else

**Export a plan as a template** writes a single JSON file. It asks whether to include the principle sequencing and row notes you have set against the plan, or export the bare calendar. Either way it never carries session content. The other coach uses **Import a template** and names it on the way in.

### Emptying a plan you have already used

Four buttons under **Start over** on the periodization page, in increasing order of damage:

| | What goes | What stays |
|---|---|---|
| **Clear row edits on this plan** | Your sequencing, focuses, player actions, notes, cancellations | The calendar, fixtures, GD numbers, default load bands, your sessions |
| **Delete sessions on this plan** | Sessions written against it | Everything on the grid |
| **Empty this plan completely** | Both of the above | The calendar itself |
| **Reset everything** | All sessions, all row edits, every plan you built, across all plans | The two built-in squads |

**Empty this plan completely** is the one that turns a season you have worked through back into a clean template while keeping the calendar. Each asks for confirmation and reports the counts first. Reset asks twice.

The built-in U13 and U19 plans cannot be deleted or edited, so there is always a known-good state to fall back to. Back up before any of this: it is one button and the file is small.

---

## What it pulls in, and from where

| Source | What it feeds |
|---|---|
| `Appendix_D_Principle_Hierarchy.md` | 25 principle codes with moment, phase, cue, sub-principles and the solutions already built. Generated into `js/data.principles.js` |
| `NCFC_U13_U19_Fall_Schedule.csv` | Every fixture, opponent, venue and kickoff |
| `Season_Structure_Fall_2026_Alex_Edwards_v3.md` | The five block boundaries, and the preseason fixtures from section 2 |
| Training pattern | Monday 75, Tuesday 90, Thursday 75 |
| `AYouth_IPM1_SessionPlan_8_22_2026.json` | The field set and the board object schema |

Days are not stored anywhere. `js/season.js` builds the calendar from a plan config on load, and the two built-in plans go through exactly the same code as one you create yourself. That is checked: the generator reproduces the previously hand-generated fall 2026 calendar for both squads, all 133 days, with no field differing.

GD numbers and default physical-load bands are computed, not typed. GD counts to the nearer of the previous or next fixture for that squad. The load default follows the usual shape (GD+1 recovery, GD-3 and GD-4 threshold, GD-1 and GD-2 organizational) and every one of them is overridable on the row.

Counts as generated: **U13** 57 training days and 18 games, **U19** 57 training days and 26 games, before you mark anything off for residentials, weather or cancellations. Mark a day OFF on the plan and the ribbon and counts follow.

---

## Three decisions you may want to argue with

**1. Diagrams are stored as vectors, not images.**
Your IPM1 file is 164 KB and roughly 90 percent of that is two base64 PNGs. At that weight a browser's 5 MB storage ceiling holds about thirty sessions. Storing the objects instead puts a session at a few KB, so the ceiling stops being the binding constraint. The PNG is rendered on demand, at export and at print, and the exported file still carries a `diagrams` block so nothing downstream notices.

**2. Activity totals and ball rolling time calculate themselves.**

```
BRT   = intervals × time
total = intro + intervals × (time + rest) + transition
```

Both come from your yearly planner, and both reproduce every activity on its SessionTemplate sheet exactly: BRT 16, 16, 16, 15 and totals 24, 22, 22, 23. The four default activities land on the same numbers, which is why a fresh session opens at 63 minutes of ball rolling time, matching the template's Expt BRT. Type over the total if a session does not fit the formula.

**3. A pass is a solid arrow and a run is dashed.**
This is the standard coaching convention and, as far as I can tell from the export, the reverse of what the IPM1 tool draws. If you would rather match the old tool, swap the two `case` blocks in `_obj` in `js/board.js`, around line 300. The stored data is unaffected either way.

---

## The diagram editor

It opens as a full modal from the activity card, with the same grouped rail as the IPM1 tool: Field, Players, Team color, Orientation, Equipment, Draw, Zones, and Cancel / Insert into plan.

Five field types: full, two thirds, half, attacking third and blank. Nine team colors. An eight-way orientation grid plus a centre button for no facing, so a piece is placed already pointing the right way. A **Number players** switch with a **Next #** box that increments as you place, which is faster than editing each one.

Kept from ours because the IPM1 tool does not have them: mannequin, disc, text label, select, erase, undo, redo and clear.

All portrait, matching the IPM1 coordinate space of 620 × 600, so old boards open in the right place.

| | |
|---|---|
| Open it | Click the thumbnail on any activity card |
| Place a piece | Pick a tool, click the pitch |
| Draw a line, pass, run or zone | Pick the tool, drag |
| Move something | Select tool, drag it. Line ends drag individually |
| Shirt number | Turn on **Number players** and set **Next #**; it counts up as you place. Double-click any player to change it |
| Rotate a player or goal | Select it, press **R**, or use the Rotate button |
| Delete | Right-click it, or select and press Delete |
| Undo | Ctrl+Z, Shift+Ctrl+Z to redo |
| Close the editor | **Insert into plan** keeps the drawing, Cancel discards it, Escape keeps it |
| Save the session | Ctrl+S |

Several diagrams per session. Each activity points at one, and that is the one that prints with it.

---

## Moving files in and out

**Export JSON** writes a superset of the IPM1 shape. The original keys are all there and unchanged, so the file opens in the IPM1 tool. The extras sit in a `sessionBoard` block that the old tool ignores: principle code, moment, phase, cue, sub-principles worked, mindset focus, block, week, GD, load band, and planned against booked minutes.

**Import JSON** reads either shape. Old IPM1 files come in with the board states intact; the principle code is recovered from the principle text where it can be. Nothing is stored until you press Save.

**Print / PDF** builds a clean sheet in Arial, US spelling, with the diagrams rendered in place and each activity kept on one page. Use your browser's Save as PDF.

---

## One build, two audiences

The app ships as a skeleton. Your content does not live in the files any more than it has to: it lives in a **seed file** that sits beside the app.

**Build a seed file** on the periodization page writes `seed.json` from everything in this browser. Put it in the folder next to `index.html` and deploy. A browser that has never used the app picks it up once and starts with your model, your season, your roster and everything else already in place, with a line at the top of the hub saying it happened.

The copy you hand to another coach is the same folder **without seed.json**. They get the skeleton.

Two safeguards. It only runs on a browser holding nothing, so it can never overwrite somebody who has started working. And the seed is skipped entirely if the file is absent, so the skeleton needs no different build.

**Should you do it?** For sharing, yes: one codebase, one deploy, and no chance of your game model going out by accident because you forgot which build you zipped. The trade is that your content now depends on that file existing, so keep `seed.json` in the repository and rebuild it when the model changes.

---

## Everything is editable, including the structured lists

The flat lists were already editable. The ones that are objects rather than words are too, on the Lists page under **Structured lists**:

- **Session feedback scales** — the name, the question as you would ask it, the aim, and every worded answer.
- **Match analysis actions** — the action, what it is drawn with, its outcomes, and a tick against each outcome that counts as a success.
- **Game sizes** — the size, what it is for, intensity, duration, recovery, both stresses, action density, and the interval and rest it wants.

Editing writes over the shipped version in place, so everything reading the vocabulary picks it up immediately. **Reset** on any of them returns to what shipped.

---

## Moving between browsers and devices

**Back up everything** now writes every store the app holds, not a named subset. It used to carry sessions, plan edits, preferences and custom plans, which meant a restore in a new browser silently arrived without the roster, the boards, the scouting, the activity library, the team sheets, the IDP targets or the session feedback.

The backup walks the storage and takes anything under the app prefix, so a store added later is included without anyone remembering to add it. The file records how many stores and how big, and which address it came from.

**Restore backup** replaces everything in that browser. A backup made on one address restores cleanly onto another, and it says so rather than warning you off. Older backups are still accepted and restore what they carried, with a note that it was sessions and plan edits only.

That is the answer to using this on more than one browser: export, move the file, restore. There is no sync, so the file is the thing that travels.

---

## Where your work lives

In this browser, on this device, under `localStorage`. Not on Netlify, not anywhere else. That means:

- Clearing site data deletes your sessions and any plans you built. **Back up everything** first: the backup file now carries plans as well.
- A different device, or a different browser, starts empty. Move work across with a backup file.
- Private or incognito windows lose everything on close.

If that ever becomes the wrong trade, the storage layer is one file (`js/store.js`) with four functions doing the reading and writing, and it can be repointed at a hosted store without touching anything else.

---

## Files

```
index.html            season overview
periodization.html    the plan
planner.html          the session
plans.html            create, copy, import and delete plans
kpi.html              KPI definitions and the field tally sheet
review.html           session preview and review
gallery.html          gallery observation sheet
idp.html              development sheets by position
depth.html            depth chart by position
404.html
netlify.toml          publish dir, headers, redirects
_redirects            same redirects, plain-text form
robots.txt            keeps it out of search results
assets/app.css
js/data.principles.js generated from Appendix D
js/data.season.js     generated from the fixture list and Season Structure v3
js/season.js          builds a calendar from a plan config, reads fixture CSVs
js/store.js           storage, plan registry, season lookups, import and export
js/board.js           the tactics board
js/home.js
js/periodization.js
js/planner.js
js/plans.js
js/kpi.js
js/kpi-page.js
js/review.js
js/gallery.js
js/nav.js             tab visibility
js/idp.js
js/depth.js
js/data.sessions.js   the session library that ships with the site
js/data.club.js       player actions, area bands, position criteria from the EVB workbook
assets/ncfc-crest.png
```

To regenerate the data files after Appendix D or the fixture list changes, the two blocks at the top of the build are plain transforms; ask and I will rerun them.
