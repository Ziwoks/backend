const fs = require('fs');
const path = require('path');
const axios = require('axios');
const ical = require('node-ical');

function formatDuration(ms) {
  const minutes = Math.floor(ms / 60000);
  const totalHours = Math.floor(minutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return `${days}j ${hours}h`;
}

async function processICS(maison, clientPath, allEvents) {
  if (!maison.icsUrl) {
    console.log(`⚠️  Pas d'URL ICS pour la maison : ${maison.nom}`);
    return;
  }

  try {
    console.log(`⏬ Téléchargement ICS pour : ${maison.nom}`);
    const response = await axios.get(maison.icsUrl);
    const events = Object.values(ical.parseICS(response.data))
      .filter(e => e.type === 'VEVENT')
      .sort((a, b) => new Date(a.start) - new Date(b.start));

    events.forEach(e => {
      const duration = formatDuration(new Date(e.end) - new Date(e.start));
      const id = `${maison.nom}-${e.start.toISOString()}`;
      allEvents.push({
        id,
        maison: maison.nom,
        start: e.start,
        end: e.end,
        date: e.start.toISOString().split("T")[0],
        duration,
        done: false,
        employe: "",
        tempsMenage: maison.tempsMenage || 0
      });
    });

  } catch (err) {
    console.error(`❌ Erreur ${maison.nom}:`, err.message);
  }
}

async function syncClient(clientId) {
  const clientPath = path.join(__dirname, 'data', 'clients', clientId);
  const maisonsPath = path.join(clientPath, 'maisons.json');
  const tachesPath = path.join(clientPath, 'taches.json');

  if (!fs.existsSync(maisonsPath)) {
    console.error("❌ Fichier maisons.json introuvable pour", clientId);
    return;
  }

  const maisons = JSON.parse(fs.readFileSync(maisonsPath, 'utf-8')).maisons || [];
  const allEvents = [];

  for (let maison of maisons) {
    await processICS(maison, clientPath, allEvents);
  }

  const data = { taches: allEvents };
  fs.writeFileSync(tachesPath, JSON.stringify(data, null, 2));
  console.log(`✅ Sync terminée pour ${clientId}`);
}

if (require.main === module) {
  const clientId = process.argv[2];
  if (!clientId) {
    console.error("❌ Usage: node sync.js [client-id]");
    process.exit(1);
  }
  syncClient(clientId);
}

module.exports = { syncClient };