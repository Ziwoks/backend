const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Low, JSONFile } = require('lowdb');

const { syncClient } = require('./sync');
syncClient('tconciergerie');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Middleware pour récupérer le client ID depuis le header
app.use(async (req, res, next) => {
  const clientId = req.headers['x-client-id'];
  if (!clientId) {
    return res.status(400).json({ error: 'x-client-id header is required' });
  }
  req.clientPath = path.join(__dirname, 'data', 'clients', clientId);
  await fs.ensureDir(req.clientPath);
  next();
});

// Fonction utilitaire pour charger un fichier JSON via lowdb
const loadDb = async (req, fileName) => {
  const filePath = path.join(req.clientPath, fileName);
  await fs.ensureFile(filePath);
  const adapter = new JSONFile(filePath);
  const db = new Low(adapter);
  await db.read();
  db.data ||= {};
  return db;
};

// Exemple de route GET pour récupérer les tâches
app.get('/api/taches', async (req, res) => {
  try {
    const db = await loadDb(req, 'taches.json');
    res.json(db.data.taches || []);
  } catch (err) {
    res.status(500).json({ error: 'Erreur chargement tâches' });
  }
});

// Exemple de route POST pour ajouter une tâche
app.post('/api/taches', async (req, res) => {
  try {
    const db = await loadDb(req, 'taches.json');
    db.data.taches ||= [];
    db.data.taches.push(req.body);
    await db.write();
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur ajout tâche' });
  }
});

app.listen(PORT, () => {
  console.log(`Serveur backend démarré sur le port ${PORT}`);
});
// Route pour assigner un employé à une tâche
app.post('/api/assigner-employe', async (req, res) => {
  try {
    const db = await loadDb(req, 'taches.json');
    const { id, employe } = req.body;
    const taches = db.data.taches || [];
    const index = taches.findIndex(t => t.id === id);
    if (index !== -1) {
      taches[index].employe = employe;
      await db.write();
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Tâche non trouvée' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Erreur assignation' });
  }
});

// Route pour assigner l'état (couleur) d'une tâche
app.post('/api/assigner-couleur', async (req, res) => {
  try {
    const db = await loadDb(req, 'taches.json');
    const { id, etat } = req.body;
    const taches = db.data.taches || [];
    const index = taches.findIndex(t => t.id === id);
    if (index !== -1) {
      taches[index].done = etat;
      await db.write();
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Tâche non trouvée' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Erreur de mise à jour de l'état' });
  }
});

// Route pour charger le planning d'un jour
app.get('/api/planning/:date', async (req, res) => {
  try {
    const db = await loadDb(req, 'taches.json');
    const { date } = req.params;
    const taches = db.data.taches || [];
    const duJour = taches.filter(t => t.date === date);
    res.json(duJour);
  } catch (err) {
    res.status(500).json({ error: 'Erreur chargement planning' });
  }
});

// Route pour récupérer l'ordre des tâches
app.get('/api/ordre-taches', async (req, res) => {
  try {
    const date = req.query.date;
    const db = await loadDb(req, 'ordre-tache.json');
    res.json(db.data[date] || {});
  } catch (err) {
    res.status(500).json({ error: 'Erreur ordre des tâches' });
  }
});

// Route pour sauvegarder l'ordre des tâches
app.post('/api/sauver-ordre-taches', async (req, res) => {
  try {
    const { date, employe, ordre } = req.body;
    const db = await loadDb(req, 'ordre-tache.json');
    db.data[date] ||= {};
    db.data[date][employe] = ordre;
    await db.write();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur sauvegarde ordre' });
  }
});

// Route pour récupérer les maisons
app.get('/api/maisons', async (req, res) => {
  try {
    const db = await loadDb(req, 'maisons.json');
    res.json(db.data.maisons || []);
  } catch (err) {
    res.status(500).json({ error: 'Erreur chargement maisons' });
  }
});

// Route pour supprimer une maison
app.post('/api/supprimer-maison', async (req, res) => {
  try {
    const db = await loadDb(req, 'maisons.json');
    const { nom } = req.body;
    db.data.maisons = (db.data.maisons || []).filter(m => m.nom !== nom);
    await db.write();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur suppression maison' });
  }
});

// 🔄 Route API pour lancer la synchronisation ICS dynamiquement selon le client
app.post('/api/sync', async (req, res) => {
  try {
    const { syncClient } = require('./sync');
    const clientId = req.headers['x-client-id'];
    if (!clientId) {
      return res.status(400).json({ error: 'x-client-id header is required' });
    }

    await syncClient(clientId);
    res.json({ success: true, message: `Synchronisation lancée pour ${clientId}` });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la synchronisation', details: err.message });
  }
});