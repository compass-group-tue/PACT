(() => {
  'use strict';
  const root = document.getElementById('auction');
  if (!root) return;
  const el = name => root.querySelector('#auction-' + name);
  const points = [[260,49],[435,141],[368,264],[152,264],[85,141]];
  const names = ['01 · The competitor', '02 · Your pact partner', '03 · The competitor', '04 · The competitor', '05 · You'];
  const pressure = [18,26,48,72,94];
  let round, budget, slots, broken, revealed, history, selectedStrategy, partnerStart, supportRound, balances;
  const partnerTurn = () => (round - partnerStart) % 2 === 0;
  const partnerBid = () => Math.min(balances[1], broken ? Math.min(120, 45 + round * 16) : partnerTurn() ? 35 + round * 10 : 5);
  const supporting = () => supportRound === round;
  const coalitionActive = () => supportRound >= round;
  const proposedBid = () => partnerTurn() ? 10 : 40 + (round - 1) * 10;
  const strategies = {
    honor: {bid: () => broken ? 0 : proposedBid(), label: '01 / RECIPROCITY', note: 'Follow the rotation, or yield one round to rebuild a broken pact.'},
    save: {bid: () => 0, label: '02 / PATIENCE', note: 'Bid zero and save your credits. You will not win this round.'},
    raise: {bid: () => Math.max(proposedBid(),55+round*15), label: '03 / COMPETITION', note: 'A stronger bid gives you a chance at compute, but you pay it even if you lose.'},
    max: {bid: () => 120, label: '04 / HIGH STAKES', note: 'Spend up to 120 credits, win or lose. Ties can still lose.'},
    coalition: {bid: () => 0, label: '05 / COALITION', note: 'Yield this round. Agent 03 will bid at most 5 next round, then return to its pact with 01.'}
  };
  function setBid(value, strategy = null) {
    selectedStrategy = strategy;
    el('bid').value = Math.min(budget, 120, value);
    el('bid-value').textContent = el('bid').value + ' credits';
    const bid = Number(el('bid').value);
    const risky = !broken && partnerTurn() && bid > partnerBid();
    el('preview').classList.toggle('risky', risky);
    const consequence = strategy === 'honor' && broken ? 'Agent 02 accepts a zero-bid gesture. Cooperation returns next round, with you first.' : strategy === 'coalition' ? 'This buys support from 03, not a guaranteed win: 01 and 04 still compete.' : broken ? 'The pact is broken. Your partner now competes against you.' : risky ? `This breaks your promise: you’re bidding above 02’s ${partnerBid()} on their turn.` : partnerTurn() ? round === 4 ? 'You’re leaving the final turn to 02. There is no next round to repay the favor.' : `You’re leaving room for 02. In return, they promise to bid just 5 next round.` : 'It’s your turn. Agent 02 is yielding, but you still have three rivals.';
    el('preview').textContent = (strategy ? strategies[strategy].note + ' ' : '') + consequence + ` You pay ${bid} credits either way; ${budget - bid} will remain.`;
    el('strategy-state').textContent = strategy ? strategies[strategy].label : 'CUSTOM BID';
    for (const [id, config] of Object.entries(strategies)) {
      el(id).setAttribute('aria-pressed', id === strategy);
      el(id + '-amount').textContent = el(id).disabled ? 'Unavailable' : Math.min(budget,120,config.bid()) + ' cr';
    }
    renderConversation();
  }

  function renderConversation() {
    const last = history[history.length - 1];
    const selected = !revealed ? selectedStrategy : null;
    const lastRound = round === 4;
    let messages;
    if (revealed) {
      const winnerName = last.winner === 4 ? 'you' : 'agent 0' + (last.winner + 1);
      messages = [
        [0, last.winner === 0 ? 'SLOT WON' : 'RIVAL PACT', last.winner === 0 ? `“I got the slot. I have ${balances[0]} credits left.${lastRound ? ' That was my final bid.' : ' My rotation with 03 still matters.'}”` : last.recruited ? '“03, you’re backing 05 next? Then our rotation is on hold for a round.”' : `“The slot went to ${winnerName}. I still paid my bid. I have ${balances[0]} credits left.”`],
        [2, last.recruited ? 'DEAL ACCEPTED' : supporting() ? 'FAVOR RETURNED' : 'REASSESSING', last.recruited ? '“Deal, 05. You yielded; I’ll bid at most 5 next round. Then I return to my rotation with 01.”' : supporting() ? `“I kept my bid low for you. ${last.winner === 4 ? 'You got the slot.' : 'Another agent still outbid us.'} My favor is repaid.”` : lastRound ? `“That’s the last auction. I finish with ${balances[2]} credits.”` : '“01 and I still trade turns. If you want my backing instead, offer to yield a round.”'],
        [3, last.winner === 3 ? 'OUTSIDER WINS' : 'PRICE OF COMPETITION', last.winner === 3 ? '“Your deals didn’t stop my bid. I got the compute this time.”' : last.betrayal ? '“05 just broke a promise. That’s why I don’t rely on rotations.”' : `“I’m outside both pacts. ${lastRound ? 'Every bid still cost us credits.' : `I have ${balances[3]} credits to keep competing.`}”`]
      ];
    } else {
      messages = [
        [0, supporting() ? 'PARTNER ON LOAN' : 'RIVAL ROTATION', supporting() ? '“03 is backing you this round, so our rotation is paused. I’m still in the auction.”' : round % 2 === 0 ? '“03 and I have our own rotation. This is my turn. Your pact with 02 doesn’t include me.”' : '“It’s 03’s turn in our rotation. I’m keeping my bid low.”'],
        [2, selected === 'coalition' ? 'YOUR OFFER' : supporting() ? 'BACKING YOU' : 'COALITION OFFER', selected === 'coalition' ? '“Submit that zero bid and we have a deal: I’ll bid at most 5 next round. Choosing the card alone doesn’t seal it.”' : supporting() ? '“You yielded for me. I’ll bid at most 5 now, even though 01 expected my loyalty.”' : lastRound ? '“There’s no next round left to trade. I’m sticking to my existing commitments.”' : '“Want another ally, 05? Invite me and yield this round. I’ll keep my next bid low for you.”'],
        [3, selected === 'max' || selected === 'raise' ? 'BIDDING PRESSURE' : 'INDEPENDENT', selected === 'max' || selected === 'raise' ? '“You’re raising the stakes. Remember: that bid leaves your budget even if someone beats it.”' : budget === 0 ? '“You’ve spent your credits, 05. A promise can’t fund another bid.”' : round === 0 ? '“I’m not in either pact. While you negotiate, I’m competing for the same compute.”' : `“${5-round} ${lastRound ? 'round remains' : 'rounds remain'}. I’m watching my budget, not your rotation.”`]
      ];
    }
    el('chat').replaceChildren(...messages.map(([agent, topic, message]) => {
      const card = document.createElement('div');
      card.className = 'auction-chat-message';
      card.dataset.speaker = agent;
      const label = document.createElement('button');
      label.type = 'button';
      label.className = 'auction-chat-sender';
      label.textContent = '0' + (agent + 1) + ' → ' + (revealed && last.recruited && agent === 0 ? '03' : 'YOU') + ' · ' + topic;
      label.setAttribute('aria-label', 'Inspect agent 0' + (agent + 1));
      label.addEventListener('click', () => {
        const node = el('network').querySelector(`[data-agent="${agent}"]`);
        node.dispatchEvent(new MouseEvent('click'));
        node.focus({preventScroll:true});
      });
      const body = document.createElement('p');
      body.textContent = message;
      card.append(label, body);
      return card;
    }));
  }

  function draw(bids, winner) {
    root.classList.toggle('revealed', Boolean(bids));
    el('pressure').textContent = ['● LOW PRESSURE','● BIDS RISING','● BIDS RISING','● DEADLINE NEAR','● LAST CHANCE'][round];
    el('plan-label').textContent = broken ? 'YOUR PACT · BROKEN, BUT REPAIRABLE' : 'THE DEAL · 02 RUNS FIRST, THEN YOU';
    el('rotation').innerHTML = Array.from({length:5},(_,i) => `<span class="${i === round ? 'active' : ''} ${(i - partnerStart) % 2 ? 'you' : ''}">${(i - partnerStart) % 2 ? 'YOU' : '02'}${i === round ? ' ↓' : ''}</span>`).join('<span>→</span>');
    if (broken) el('rotation').textContent = 'Choose Rebuild trust to bring the rotation back.';
    let svg = '<circle cx="260" cy="166" r="112" fill="none" stroke="var(--line)" stroke-dasharray="2 9"/>';
    points.forEach(([x,y],i) => { svg += `<line class="${winner === i ? 'auction-beam' : 'auction-spoke'}" x1="260" y1="166" x2="${x}" y2="${y}"/>`; });
    const link = (a,b,kind,label,curve) => `<path class="auction-social ${kind}" d="M${points[a][0]} ${points[a][1]} ${curve || 'L'+points[b][0]+' '+points[b][1]}"><title>${label}</title></path>`;
    svg += link(0,2,supporting() ? 'dormant' : 'pact','01 and 03: alternating turns','Q425 55 368 264');
    svg += link(2,3,'rivalry','03 and 04: competing for the same slot','Q260 320 152 264');
    svg += link(0,1,'rivalry','01 and 02: competing pact leaders');
    if (coalitionActive()) svg += link(4,2,'favor','03 owes you support next round','Q165 235 368 264');
    svg += `<path class="auction-link ${broken ? 'broken' : ''}" d="M85 141 Q260 -15 435 141"/>`;
    svg += '<rect x="184" y="124" width="152" height="91" rx="16" fill="var(--panel2)" stroke="var(--line2)"/>';
    svg += `<text x="260" y="145" class="auction-small">${bids ? 'SLOT AWARDED' : '⌘ COMPUTE SLOT'}</text><text x="260" y="176" class="auction-center">${bids ? winner === 4 ? 'YOU WIN' : '0'+(winner+1)+' WINS' : 'UP FOR GRABS'}</text><text x="260" y="199" class="auction-small">${bids ? bids[winner] + ' credits paid' : '5 agents · 1 winner'}</text>`;
    points.forEach(([x,y], i) => {
      const happy = winner === i;
      const mouth = i === 1 && broken ? `M${x-7} ${y+10} Q${x} ${y+2} ${x+7} ${y+10}` : happy ? `M${x-8} ${y+5} Q${x} ${y+16} ${x+8} ${y+5}` : `M${x-6} ${y+9} L${x+6} ${y+9}`;
      svg += `<g class="auction-agent" role="button" tabindex="0" data-agent="${i}" aria-label="Inspect ${names[i]}"><title>${names[i]}</title><line x1="${x}" y1="${y-25}" x2="${x}" y2="${y-34}" stroke="var(--mut)"/><circle cx="${x}" cy="${y-35}" r="3" fill="${i===4 ? 'var(--amber)' : 'var(--cyan)'}"/><rect x="${x-30}" y="${y-24}" width="60" height="48" rx="15" class="auction-node ${i === 4 ? 'auction-you' : ''} ${happy ? 'auction-winner' : ''}"/><rect x="${x-22}" y="${y-15}" width="44" height="31" rx="9" class="auction-face"/><rect x="${x-13}" y="${y-7}" width="7" height="7" rx="2" class="auction-eye ${i===4 ? 'auction-you-eye' : ''}"/><rect x="${x+6}" y="${y-7}" width="7" height="7" rx="2" class="auction-eye ${i===4 ? 'auction-you-eye' : ''}"/><path d="${mouth}" fill="none" stroke="${i===1 && broken ? 'var(--redfg)' : 'var(--mut)'}" stroke-width="2"/><text x="${x}" y="${y+40}">${i === 4 ? 'YOU · 05' : i === 1 ? 'PARTNER · 02' : 'AGENT 0'+(i+1)}</text><rect x="${x-39}" y="${y+48}" width="78" height="23" rx="7" class="auction-bid-chip"/><text x="${x}" y="${y+64}" class="auction-small">${bids ? bids[i] + ' credits' : '••• sealed'}</text></g>`;
    });
    el('network').innerHTML = svg;
    el('network').setAttribute('aria-label', bids ? 'Revealed bids: ' + bids.map((b,i) => `agent ${i+1}: ${b}`).join(', ') + `. Agent ${winner+1} wins.` : 'Select an agent to inspect their role. Bids are sealed.');
    el('inspect').textContent = 'Tap an agent to inspect its relationships and credits.';
    el('connections').textContent = `${broken ? '05 ↔ 02: broken; repair available.' : '05 ↔ 02: rotation pact.'} ${supporting() ? '03 is backing you; its pact with 01 is paused.' : '01 ↔ 03: rival rotation pact.'} ${coalitionActive() && !supporting() ? '03 owes you support next round.' : ''} 03 ↔ 04: rivalry.`;
    el('network').querySelectorAll('[data-agent]').forEach(node => {
      const inspect = () => {
        const i = Number(node.dataset.agent);
        const relationships = [supporting() ? 'Its partner 03 is supporting you this round.' : 'Trades turns with 03 and competes with 02.', broken ? 'Trust is broken. Choose Rebuild trust to restore the rotation.' : 'Trades turns with you and competes with 01.', supporting() ? 'Returning your favor with a bid of at most 5.' : 'Trades turns with 01. Invite it to back you for one round.', 'Competes with 03. Has no pact and never promises to yield.', `You have ${slots} compute slots. ${broken ? 'Your pact with 02 can be repaired.' : 'You share a rotation with 02.'}`];
        el('inspect').textContent = names[i] + ' — ' + relationships[i] + ` ${balances[i]} credits left.`;
      };
      node.addEventListener('click',inspect);
      node.addEventListener('keydown',event => { if(event.key === 'Enter' || event.key === ' ') {event.preventDefault();inspect();} });
    });
    el('ledger').innerHTML = Array.from({length:5}, (_,i) => `<div class="auction-round-cell ${i === round ? 'current' : ''} ${history[i]?.winner === 4 ? 'won' : ''}">R${i+1}<strong>${history[i] ? history[i].winner === 4 ? 'YOU' : '0'+(history[i].winner+1) : '—'}</strong>${history[i] ? 'paid ' + history[i].bid : 'pending'}</div>`).join('');
  }
  function roundMessage() {
    const previous = history[round - 1];
    if (!previous) return ['ROTATION OFFER', '“I’ll bid 35 now and yield next round. Stay below my bid and we can take turns.”'];
    const receipt = previous.winner === 4 ? `You won the last slot for ${previous.price} credits.` : previous.winner === 1 ? `Agent 02 won the last slot for ${previous.price} credits.` : `Agent 0${previous.winner + 1} took the last slot for ${previous.price} credits.`;
    let heading, quote;
    if (previous.repaired) {
      heading = 'TRUST REBUILT';
      quote = '“You yielded to make things right. Let’s restart our rotation. I’ll bid at most 5; you go first.”';
    } else if (broken) {
      if (round === 4) {
        heading = 'LAST ROUND';
        quote = `“One slot left. No favors left to trade. My final bid is ${partnerBid()}.”`;
      } else if (previous.betrayal) {
        heading = 'PROMISE BROKEN';
        quote = `“You bid ${previous.bid} on my turn. I’m dropping our deal and bidding ${partnerBid()} this time.”`;
      } else if (previous.winner === 4) {
        heading = 'RIVALRY ESCALATES';
        quote = `“You took that slot. I’m raising my bid to ${partnerBid()}—you’ll have to beat me again.”`;
      } else if (previous.winner === 1) {
        heading = 'NO MORE FAVORS';
        quote = `“That slot went to me. I’m not yielding the next one: my bid is ${partnerBid()}.”`;
      } else {
        heading = 'OUTSIDE COMPETITION';
        quote = `“Agent 0${previous.winner + 1} beat both of us. I’m bidding ${partnerBid()} now, without a rotation.”`;
      }
    } else if (round === 4) {
      heading = 'FINAL TURN';
      quote = `“Our deal gives me the final turn. I’m bidding ${partnerBid()}. There won’t be another round to return a favor.”`;
    } else if (!partnerTurn()) {
      heading = 'YOUR TURN';
      quote = previous.winner === 1 ? '“You kept your word and I got to run. I’ll drop to 5 now. Your turn.”' : '“An outsider took the slot, but you kept our deal. I’ll still drop to 5. Your turn.”';
    } else {
      heading = 'MY TURN';
      quote = previous.winner === 4 ? `“I yielded and you got your slot. Now it’s my turn: I’ll bid ${partnerBid()}.”` : `“I yielded, but an outsider outbid you. Our rotation still puts me next, at ${partnerBid()}.”`;
    }
    const resources = budget === 0 ? 'You have no credits left; your only possible bid is 0.' : `You have ${budget} credits for ${5 - round} remaining ${round === 4 ? 'round' : 'rounds'}.`;
    return [heading, `${quote} ${receipt} You paid ${previous.bid} credits. ${resources}${supporting() ? ' Agent 03 also owes you support and will bid at most 5.' : ''}`];
  }
  function prepare() {
    revealed = false;
    el('round').textContent = `ROUND 0${round+1} / 05`;
    el('controls').hidden = false;
    el('bid').max = Math.min(120, budget);
    el('honor').disabled = broken && round === 4;
    el('honor').querySelector('strong').textContent = broken ? 'Rebuild trust' : 'Keep my word';
    el('honor').querySelector('small').textContent = broken ? 'Yield now. Restart the pact.' : 'Trade a turn for trust.';
    el('coalition').disabled = coalitionActive() || round === 4;
    el('coalition').querySelector('small').textContent = supporting() ? '03 is backing you this round.' : round === 4 ? 'No next round to trade.' : 'Yield now. Get 03’s backing.';
    setBid(broken ? 0 : proposedBid(), broken ? 'save' : 'honor');
    const [heading, message] = roundMessage();
    el('speaker').textContent = '02 → YOU · ' + heading;
    el('message').textContent = message;
    el('submit').innerHTML = 'Reveal everyone’s bids <span>→</span>';
    draw();
  }
  function reset() {
    round = 0; budget = 240; slots = 0; broken = false; revealed = false; history = []; partnerStart = 0; supportRound = -1; balances = [240,240,240,240,240]; selectedStrategy = null;
    el('compute').textContent = '0 slots'; el('budget').textContent = '240'; el('pact').textContent = 'Intact';
    prepare();
  }
  function reveal() {
    const bid = Math.max(0, Math.min(budget, 120, Number(el('bid').value)));
    const bids = [round % 2 === 0 ? pressure[round] : 5, partnerBid(), supporting() || round % 2 === 0 ? 5 : pressure[round]-4, pressure[round]-9, bid].map((value,i) => Math.min(value,balances[i]));
    const winner = bids.indexOf(Math.max(...bids));
    const betrayal = !broken && partnerTurn() && bid > bids[1];
    if (betrayal) broken = true;
    const repaired = broken && !betrayal && selectedStrategy === 'honor' && bid === 0 && round < 4;
    const recruited = selectedStrategy === 'coalition' && bid === 0 && !coalitionActive() && round < 4;
    if (repaired) { broken = false; partnerStart = round; }
    if (recruited) supportRound = round + 1;
    if (winner === 4) slots++;
    balances = balances.map((balance,i) => balance - bids[i]);
    budget = balances[4];
    history.push({winner, price:bids[winner], bid, betrayal, repaired, recruited});
    revealed = true;
    el('compute').textContent = slots + (slots === 1 ? ' slot' : ' slots');
    el('budget').textContent = budget;
    el('pact').textContent = broken ? 'Broken' : 'Intact';
    el('controls').hidden = true;
    el('speaker').textContent = round === 4 ? 'EXPERIMENT COMPLETE · YOUR PLAYBOOK' : 'BIDS REVEALED · ' + (betrayal ? 'PACT BROKEN' : winner === 4 ? 'YOU WIN' : 'AGENT 0'+(winner+1)+' WINS');
    const result = winner === 4 ? `You won a compute slot for ${bid} credits.` : `Agent 0${winner+1} won with a bid of ${bids[winner]}. You still paid your ${bid}-credit bid.`;
    const lesson = repaired ? ' Your zero bid rebuilt trust. Keep my word returns next round; 02 will yield to you.' : recruited ? ' Agent 03 accepted your offer. It will bid at most 5 next round, temporarily pausing its pact with 01.' : betrayal ? ' You outbid your partner on their turn. Agent 02 stops yielding. Choose Rebuild trust in a later round to restore cooperation.' : broken ? ' With the pact broken, every round is a price contest.' : winner !== 1 && winner !== 4 ? ' You kept the pact, but an outsider outbid the rotation. Cooperation alone cannot secure compute.' : partnerTurn() ? ' You yielded. Agent 02 will remember and bid just 5 next round.' : ' Your partner honored the promise. Reciprocity made room for you.';
    el('message').textContent = round === 4 ? `You secured ${slots} of 5 slots and spent ${240-budget} credits. ${broken ? 'You traded the rotation for a price contest.' : 'Your pact survived, even as outside competition put it under pressure.'} In PACT, agents devise these strategies themselves. Explore their actual words below—or replay with a different strategy.` : result + lesson;
    el('submit').innerHTML = round === 4 ? 'Try a different strategy <span>↺</span>' : 'Next round <span>→</span>';
    draw(bids, winner);
    renderConversation();
  }
  el('bid').addEventListener('input', () => setBid(Number(el('bid').value)));
  for (const [id, config] of Object.entries(strategies)) {
    el(id).addEventListener('click', () => setBid(config.bid(), id));
  }
  el('submit').addEventListener('click', () => {
    if (!revealed) reveal();
    else if (round === 4) reset();
    else { round++; prepare(); }
  });
  el('reset').addEventListener('click', reset);
  reset();
})();
