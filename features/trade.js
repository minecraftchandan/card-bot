const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const db = require('../firebase');
const { getSupabase } = require('../supabase-client');
const supabase = getSupabase();

module.exports = (client) => {
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    const content = message.content.trim();
    if (!/^pct(\s|$)/i.test(content.split(/\s+/)[0])) return;

    let targetUser = message.mentions.users.first();
    if (!targetUser && message.reference) {
      try {
        const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
        if (repliedMsg) targetUser = repliedMsg.author;
      } catch {}
    }
    if (!targetUser || targetUser.bot || targetUser.id === message.author.id) {
      return message.reply('You must trade with another user!');
    }

    const embed = new EmbedBuilder()
      .setTitle('Pokémon Card Trade Request')
      .setDescription(`🔄 <@${message.author.id}> wants to trade with <@${targetUser.id}>

<@${targetUser.id}>, do you accept?`)
      .setColor('#FFD700');
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('trade_accept').setLabel('✅ Accept').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('trade_decline').setLabel('❌ Decline').setStyle(ButtonStyle.Danger)
    );
    const tradeMsg = await message.reply({ embeds: [embed], components: [row] });

    const filter = (i) => ['trade_accept', 'trade_decline'].includes(i.customId) && [message.author.id, targetUser.id].includes(i.user.id);
    const collector = tradeMsg.createMessageComponentCollector({ filter, componentType: ComponentType.Button, time: 60_000 });
    let accepted = false;
    collector.on('collect', async (interaction) => {
      if (interaction.customId === 'trade_decline') {
        collector.stop('declined');
        return interaction.update({ embeds: [embed.setDescription('❌ Trade declined.')], components: [] });
      }
      if (interaction.customId === 'trade_accept' && interaction.user.id === targetUser.id) {
        accepted = true;
        collector.stop('accepted');

        const tradeState = {
          [message.author.id]: { card: null, coins: 0 },
          [targetUser.id]: { card: null, coins: 0 },
        };
        let ready = { [message.author.id]: false, [targetUser.id]: false };

        const tradePanel = () => {
          const box = (userId) => {
            const state = tradeState[userId];
            const code = state.card || '';
            const coins = state.coins || 0;
            const coinDisplay = coins > 0 ? coins.toString() : '-';
            const readyMark = ready[userId] ? ' ✅' : '';
            return (
              '```' +
              `Card: ${code || 'None'}${readyMark}\n` +
              `Coins: ${coinDisplay}` +
              '```'
            );
          };

          return new EmbedBuilder()
            .setTitle('Pokémon Card Trade')
            .setDescription(
              `**${message.author.username}**\n${box(message.author.id)}\n\n` +
              `**${targetUser.username}**\n${box(targetUser.id)}\n\n` +
              `Type a card code (e.g. \`abc123\`) or \`coins <amount>\` to offer. Click ✅ when ready.`
            )
            .setColor('#4F8EF7');
        };

        const tradeRow = () => new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('trade_ready').setLabel('✅ Check').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('trade_decline').setLabel('❌ Decline').setStyle(ButtonStyle.Danger)
        );

        let tradeMsgPanel = await tradeMsg.edit({ embeds: [tradePanel()], components: [tradeRow()] });

        const msgFilter = m => [message.author.id, targetUser.id].includes(m.author.id) && !m.author.bot;
        const msgCollector = message.channel.createMessageCollector({ filter: msgFilter, time: 120_000 });
        const btnCollector = tradeMsgPanel.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120_000 });

        msgCollector.on('collect', async (m) => {
          const user = m.author.id;
          const content = m.content.trim().toLowerCase();
          let processed = false;

          // Process coin commands (must start with "coins")
          if (/^coins\s+\d+$/.test(content)) {
            processed = true;
            const amount = parseInt(content.split(/\s+/)[1]);
            if (amount <= 0) {
              await m.reply({ content: '❌ Please enter a positive amount of coins.', ephemeral: true }).catch(() => {});
              return;
            }
            
            // Check if user has enough coins
            const { data, error } = await supabase.from('coins').select('balance').eq('user_id', user).single();
            
            if (error && error.code !== 'PGRST116') {
              console.error('Supabase error:', error);
              await m.reply({ content: '❌ Error checking coin balance.', ephemeral: true }).catch(() => {});
              return;
            }
            
            // If user doesn't exist in database or has insufficient balance
            if (!data || data.balance < amount) {
              const currentBalance = data ? data.balance : 0;
              await m.reply({ content: `❌ Not enough coins. You have ${currentBalance} coins.`, ephemeral: true }).catch(() => {});
              return;
            }
            
            // Set the coins in trade state and update the trade panel
            tradeState[user].coins = amount;
          } 
          // Process card codes (must be exactly a card code format)
          else if (/^[a-z0-9]{3,10}$/.test(content)) {
            // Check if this might be a card code
            const userCol = db.collection((await m.client.users.fetch(user)).username);
            const snap = await userCol.where('code', '==', content).limit(1).get();
            
            if (!snap.empty) {
              processed = true;
              if (tradeState[user].card) {
                await m.reply({ content: '❌ You already offered a card. Cancel the trade to change your offer.', ephemeral: true }).catch(() => {});
                return;
              }
              
              tradeState[user].card = content;
              await m.reply({ content: `✅ You offered card \`${content}\`.`, ephemeral: false }).catch(() => {});
            }
          }

          // Only update the trade panel if we processed a valid command
          if (processed) {
            await tradeMsgPanel.edit({ embeds: [tradePanel()] });
          }
        });

        btnCollector.on('collect', async (i) => {
          if (i.customId === 'trade_decline') {
            btnCollector.stop('declined');
            msgCollector.stop('declined');
            return i.update({ embeds: [tradePanel().setDescription('❌ Trade cancelled.')], components: [] });
          }
          if (i.customId === 'trade_ready') {
            ready[i.user.id] = true;
            if (ready[message.author.id] && ready[targetUser.id]) {
              const box1 = tradeState[message.author.id];
              const box2 = tradeState[targetUser.id];
              if (!box1.card && !box1.coins && !box2.card && !box2.coins) {
                ready[i.user.id] = false;
                return i.reply({ content: 'At least one user must offer something.', ephemeral: true });
              }

              btnCollector.stop('done');
              msgCollector.stop('done');

              let tradeResult = '';

              async function moveCard(fromId, toId, code) {
                if (!code) return '';
                const fromCol = db.collection((await i.client.users.fetch(fromId)).username);
                const toCol = db.collection((await i.client.users.fetch(toId)).username);
                const snap = await fromCol.where('code', '==', code).limit(1).get();
                if (snap.empty) return `\n❌ <@${fromId}> does not own card \`${code}\``;
                const doc = snap.docs[0];
                const cardData = doc.data();
                await toCol.doc(doc.id).set(cardData);
                await fromCol.doc(doc.id).delete();
                return `\n✅ <@${fromId}> traded card \`${code}\` to <@${toId}>`;
              }

              async function moveCoins(fromId, toId, amount) {
                if (!amount || amount <= 0) return '';
                
                try {
                  // Get sender's balance
                  const { data: fromData, error: fromErr } = await supabase.from('coins').select('balance').eq('user_id', fromId).single();
                  
                  if (fromErr) {
                    console.error('Supabase error (sender):', fromErr);
                    return `\n❌ Error processing coin transfer.`;
                  }
                  
                  if (!fromData || fromData.balance < amount) {
                    return `\n❌ <@${fromId}> does not have enough coins.`;
                  }
                  
                  // Get receiver's balance
                  let { data: toData, error: toErr } = await supabase.from('coins').select('balance').eq('user_id', toId).single();
                  let receiverBalance = 0;
                  
                  if (toErr && toErr.code === 'PGRST116') {
                    // Receiver doesn't exist in database, create new record
                    const { error: insertErr } = await supabase.from('coins').insert({ user_id: toId, balance: 0 });
                    if (insertErr) {
                      return `\n❌ Error creating coin record for receiver.`;
                    }
                  } else if (toErr) {
                    return `\n❌ Error checking receiver's balance.`;
                  } else {
                    receiverBalance = toData.balance;
                  }
                  
                  // Update sender's balance (deduct coins)
                  const { error: updateFromErr } = await supabase.from('coins')
                    .update({ balance: fromData.balance - amount })
                    .eq('user_id', fromId);
                    
                  if (updateFromErr) {
                    return `\n❌ Error updating sender's balance.`;
                  }
                  
                  // Update receiver's balance (add coins)
                  const { error: updateToErr } = await supabase.from('coins')
                    .update({ balance: receiverBalance + amount })
                    .eq('user_id', toId);
                    
                  if (updateToErr) {
                    // Attempt to revert the sender's balance if receiver update fails
                    await supabase.from('coins').update({ balance: fromData.balance }).eq('user_id', fromId);
                    return `\n❌ Error updating receiver's balance.`;
                  }
                  
                  return `\n💰 <@${fromId}> sent \`${amount}\` coins to <@${toId}>`;
                } catch (err) {
                  console.error('Unexpected error in coin transfer:', err);
                  return `\n❌ Unexpected error during coin transfer.`;
                }
              }

              // Execute the trades
              const cardResult1 = await moveCard(message.author.id, targetUser.id, box1.card);
              const cardResult2 = await moveCard(targetUser.id, message.author.id, box2.card);
              const coinResult1 = await moveCoins(message.author.id, targetUser.id, box1.coins);
              const coinResult2 = await moveCoins(targetUser.id, message.author.id, box2.coins);
              
              tradeResult += cardResult1;
              tradeResult += cardResult2;
              tradeResult += coinResult1;
              tradeResult += coinResult2;
              
              // Log the trade in the database - simpler approach
              try {
                // Single trade log entry with exact columns from your table
                const tradeLog = {
                  from_user_id: message.author.id,
                  to_user_id: targetUser.id,
                  from_type: box1.card ? 'card' : (box1.coins > 0 ? 'coins' : 'nothing'),
                  from_value: box1.card || (box1.coins > 0 ? box1.coins.toString() : 'none'),
                  to_type: box2.card ? 'card' : (box2.coins > 0 ? 'coins' : 'nothing'),
                  to_value: box2.card || (box2.coins > 0 ? box2.coins.toString() : 'none'),
                  trade_time: new Date(),
                  success: !tradeResult.includes('❌')
                };
                
                console.log('Logging trade:', tradeLog);
                const { error } = await supabase.from('trade_logs').insert(tradeLog);
                
                if (error) {
                  console.error('Error logging trade to Supabase:', error);
                }
              } catch (error) {
                console.error('Error in trade logging:', error);
              }

              if (!tradeResult.trim()) tradeResult = '\nNo items were transferred.';

              return i.update({ embeds: [tradePanel().setDescription('✅ Trade complete!' + tradeResult)], components: [] });
            } else {
              await i.reply({ content: 'Waiting for the other user to check.', ephemeral: true });
            }
          }
        });

        btnCollector.on('end', async () => {
          try { await tradeMsgPanel.edit({ components: [] }); } catch {}
        });
        msgCollector.on('end', async () => {
          try { await tradeMsgPanel.edit({ components: [] }); } catch {}
        });
      }
    });

    collector.on('end', async () => {
      try { await tradeMsg.edit({ components: [] }); } catch {}
    });
  });
};
// features/trade.js