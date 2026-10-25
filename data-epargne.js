// Relevés du compte épargne Livret Bourso+ — année 2026
// Données saisies depuis les relevés Boursorama (janvier → septembre 2026).
// Chaque mois contient son solde de départ, son solde de fin et la liste
// des mouvements :
//   type    : 'revenu' (crédit) ou 'depense' (débit)
//   cat     : catégorie utilisée par l'application
//   montant : montant positif
//   interne : true pour un virement entre le Livret et le compte commun
//             (ces mouvements sont affichés mais exclus des calculs de budget)
// Les mois d'octobre à décembre n'ont pas encore de relevé : soldes à null,
// la courbe s'arrête donc au dernier relevé importé (septembre).

window.BUDGET_EPARGNE_2026 = [
    {
        "mois": "janvier",
        "soldeDebut": 2104.00,
        "soldeFin": 1923.39,
        "operations": [
            { "date": "02/01/2026", "label": "Intérêts bruts", "type": "revenu", "cat": "Autre revenu", "montant": 1.98 },
            { "date": "02/01/2026", "label": "Prélèvements fiscaux", "type": "depense", "cat": "Opération banquaire", "montant": 0.25 },
            { "date": "02/01/2026", "label": "Prélèvements sociaux", "type": "depense", "cat": "Opération banquaire", "montant": 0.34 },
            { "date": "05/01/2026", "label": "Épargne programmée", "type": "revenu", "cat": "mouvement interne créditeur", "montant": 200.00, "interne": true },
            { "date": "12/01/2026", "label": "Virement vers compte commun", "type": "depense", "cat": "mouvement interne débiteur", "montant": 750.00, "interne": true },
            { "date": "12/01/2026", "label": "Remboursement cantine", "type": "revenu", "cat": "Autre revenu", "montant": 68.00 },
            { "date": "26/01/2026", "label": "Virement vers compte commun", "type": "depense", "cat": "mouvement interne débiteur", "montant": 100.00, "interne": true },
            { "date": "26/01/2026", "label": "Virement vers compte commun", "type": "depense", "cat": "mouvement interne débiteur", "montant": 100.00, "interne": true },
            { "date": "28/01/2026", "label": "Épargne bancaire", "type": "revenu", "cat": "mouvement interne créditeur", "montant": 500.00, "interne": true }
        ]
    },
    {
        "mois": "fevrier",
        "soldeDebut": 1923.39,
        "soldeFin": 1176.39,
        "operations": [
            { "date": "04/02/2026", "label": "Épargne programmée", "type": "revenu", "cat": "mouvement interne créditeur", "montant": 200.00, "interne": true },
            { "date": "10/02/2026", "label": "Remboursement cantine", "type": "revenu", "cat": "Autre revenu", "montant": 68.00 },
            { "date": "10/02/2026", "label": "Remboursement Steampod", "type": "revenu", "cat": "Autre revenu", "montant": 50.00 },
            { "date": "10/02/2026", "label": "Remboursement lit", "type": "revenu", "cat": "Autre revenu", "montant": 125.00 },
            { "date": "19/02/2026", "label": "Virement vers compte commun", "type": "depense", "cat": "mouvement interne débiteur", "montant": 160.00, "interne": true },
            { "date": "19/02/2026", "label": "Virement vers compte commun", "type": "depense", "cat": "mouvement interne débiteur", "montant": 980.00, "interne": true },
            { "date": "23/02/2026", "label": "Virement vers compte commun", "type": "depense", "cat": "mouvement interne débiteur", "montant": 50.00, "interne": true },
            { "date": "24/02/2026", "label": "Virement vers compte commun", "type": "depense", "cat": "mouvement interne débiteur", "montant": 120.00, "interne": true },
            { "date": "25/02/2026", "label": "Virement depuis compte commun", "type": "revenu", "cat": "mouvement interne créditeur", "montant": 120.00, "interne": true }
        ]
    },
    {
        "mois": "mars",
        "soldeDebut": 1176.39,
        "soldeFin": 1731.39,
        "operations": [
            { "date": "03/03/2026", "label": "Virement depuis compte commun", "type": "revenu", "cat": "mouvement interne créditeur", "montant": 350.00, "interne": true },
            { "date": "04/03/2026", "label": "Épargne programmée", "type": "revenu", "cat": "mouvement interne créditeur", "montant": 200.00, "interne": true },
            { "date": "10/03/2026", "label": "Remboursement Steampod", "type": "revenu", "cat": "Autre revenu", "montant": 50.00 },
            { "date": "10/03/2026", "label": "Remboursement lit", "type": "revenu", "cat": "Autre revenu", "montant": 125.00 },
            { "date": "10/03/2026", "label": "Remboursement cantine", "type": "revenu", "cat": "Autre revenu", "montant": 54.00 },
            { "date": "23/03/2026", "label": "Virement vers compte commun", "type": "depense", "cat": "mouvement interne débiteur", "montant": 74.00, "interne": true },
            { "date": "26/03/2026", "label": "Virement vers compte commun", "type": "depense", "cat": "mouvement interne débiteur", "montant": 150.00, "interne": true }
        ]
    },
    {
        "mois": "avril",
        "soldeDebut": 1731.39,
        "soldeFin": 1424.39,
        "operations": [
            { "date": "07/04/2026", "label": "Virement vers compte commun", "type": "depense", "cat": "mouvement interne débiteur", "montant": 105.00, "interne": true },
            { "date": "07/04/2026", "label": "Wakeboard", "type": "depense", "cat": "loisir", "montant": 440.00 },
            { "date": "07/04/2026", "label": "Épargne programmée", "type": "revenu", "cat": "mouvement interne créditeur", "montant": 200.00, "interne": true },
            { "date": "10/04/2026", "label": "Avance lunettes", "type": "depense", "cat": "santé", "montant": 191.00 },
            { "date": "10/04/2026", "label": "Remboursement Steampod", "type": "revenu", "cat": "Autre revenu", "montant": 50.00 },
            { "date": "10/04/2026", "label": "Remboursement lit", "type": "revenu", "cat": "Autre revenu", "montant": 125.00 },
            { "date": "10/04/2026", "label": "Remboursement cantine", "type": "revenu", "cat": "Autre revenu", "montant": 54.00 }
        ]
    },
    {
        "mois": "mai",
        "soldeDebut": 1424.39,
        "soldeFin": 1964.39,
        "operations": [
            { "date": "04/05/2026", "label": "Épargne programmée", "type": "revenu", "cat": "mouvement interne créditeur", "montant": 200.00, "interne": true },
            { "date": "07/05/2026", "label": "CGOS études enfants", "type": "revenu", "cat": "Autre revenu", "montant": 590.00 },
            { "date": "11/05/2026", "label": "Virement vers compte commun", "type": "depense", "cat": "mouvement interne débiteur", "montant": 200.00, "interne": true },
            { "date": "11/05/2026", "label": "Virement depuis compte commun", "type": "revenu", "cat": "mouvement interne créditeur", "montant": 35.00, "interne": true },
            { "date": "11/05/2026", "label": "Remboursement wakeboard", "type": "revenu", "cat": "Autre revenu", "montant": 88.00 },
            { "date": "11/05/2026", "label": "Remboursement lunettes", "type": "revenu", "cat": "Autre revenu", "montant": 48.00 },
            { "date": "11/05/2026", "label": "Remboursement Steampod", "type": "revenu", "cat": "Autre revenu", "montant": 50.00 },
            { "date": "11/05/2026", "label": "Remboursement lit", "type": "revenu", "cat": "Autre revenu", "montant": 125.00 },
            { "date": "11/05/2026", "label": "Remboursement cantine", "type": "revenu", "cat": "Autre revenu", "montant": 54.00 },
            { "date": "21/05/2026", "label": "Virement vers compte commun", "type": "depense", "cat": "mouvement interne débiteur", "montant": 200.00, "interne": true },
            { "date": "21/05/2026", "label": "Virement vers compte commun", "type": "depense", "cat": "mouvement interne débiteur", "montant": 100.00, "interne": true },
            { "date": "21/05/2026", "label": "Virement vers compte commun", "type": "depense", "cat": "mouvement interne débiteur", "montant": 150.00, "interne": true }
        ]
    },
    {
        "mois": "juin",
        "soldeDebut": 1964.39,
        "soldeFin": 2000.44,
        "operations": [
            { "date": "01/06/2026", "label": "Virement vers compte commun", "type": "depense", "cat": "mouvement interne débiteur", "montant": 498.95, "interne": true },
            { "date": "03/06/2026", "label": "Épargne bancaire", "type": "revenu", "cat": "mouvement interne créditeur", "montant": 300.00, "interne": true },
            { "date": "04/06/2026", "label": "Épargne programmée", "type": "revenu", "cat": "mouvement interne créditeur", "montant": 200.00, "interne": true },
            { "date": "08/06/2026", "label": "Virement vers compte commun", "type": "depense", "cat": "mouvement interne débiteur", "montant": 1046.00, "interne": true },
            { "date": "09/06/2026", "label": "Virement depuis compte commun", "type": "revenu", "cat": "mouvement interne créditeur", "montant": 715.00, "interne": true },
            { "date": "10/06/2026", "label": "Virement depuis compte commun", "type": "revenu", "cat": "mouvement interne créditeur", "montant": 35.00, "interne": true },
            { "date": "10/06/2026", "label": "Remboursement wakeboard", "type": "revenu", "cat": "Autre revenu", "montant": 88.00 },
            { "date": "10/06/2026", "label": "Remboursement lunettes", "type": "revenu", "cat": "Autre revenu", "montant": 48.00 },
            { "date": "10/06/2026", "label": "Remboursement lit", "type": "revenu", "cat": "Autre revenu", "montant": 125.00 },
            { "date": "15/06/2026", "label": "Virement vers compte commun", "type": "depense", "cat": "mouvement interne débiteur", "montant": 200.00, "interne": true },
            { "date": "19/06/2026", "label": "Virement vers compte commun", "type": "depense", "cat": "mouvement interne débiteur", "montant": 500.00, "interne": true },
            { "date": "23/06/2026", "label": "Virement vers compte commun", "type": "depense", "cat": "mouvement interne débiteur", "montant": 230.00, "interne": true },
            { "date": "24/06/2026", "label": "Virement vers compte commun", "type": "depense", "cat": "mouvement interne débiteur", "montant": 200.00, "interne": true },
            { "date": "25/06/2026", "label": "Virement vers compte commun", "type": "depense", "cat": "mouvement interne débiteur", "montant": 100.00, "interne": true },
            { "date": "25/06/2026", "label": "Virement vers compte commun", "type": "depense", "cat": "mouvement interne débiteur", "montant": 100.00, "interne": true },
            { "date": "26/06/2026", "label": "Virement depuis compte commun", "type": "revenu", "cat": "mouvement interne créditeur", "montant": 1400.00, "interne": true }
        ]
    },
    {
        "mois": "juillet",
        "soldeDebut": 2000.44,
        "soldeFin": 1500.44,
        "operations": [
            { "date": "06/07/2026", "label": "Épargne programmée", "type": "revenu", "cat": "mouvement interne créditeur", "montant": 200.00, "interne": true },
            { "date": "08/07/2026", "label": "Location Airbnb", "type": "depense", "cat": "voyage et transport", "montant": 90.00 },
            { "date": "10/07/2026", "label": "Virement depuis compte commun", "type": "revenu", "cat": "mouvement interne créditeur", "montant": 35.00, "interne": true },
            { "date": "10/07/2026", "label": "Remboursement wakeboard", "type": "revenu", "cat": "Autre revenu", "montant": 88.00 },
            { "date": "10/07/2026", "label": "Remboursement lunettes", "type": "revenu", "cat": "Autre revenu", "montant": 48.00 },
            { "date": "10/07/2026", "label": "Remboursement lit", "type": "revenu", "cat": "Autre revenu", "montant": 125.00 },
            { "date": "13/07/2026", "label": "Virement vers compte commun", "type": "depense", "cat": "mouvement interne débiteur", "montant": 200.00, "interne": true },
            { "date": "14/07/2026", "label": "Vacances Landes", "type": "depense", "cat": "voyage et transport", "montant": 350.00 },
            { "date": "17/07/2026", "label": "Virement vers compte commun", "type": "depense", "cat": "mouvement interne débiteur", "montant": 200.00, "interne": true },
            { "date": "20/07/2026", "label": "Virement vers compte commun", "type": "depense", "cat": "mouvement interne débiteur", "montant": 156.00, "interne": true }
        ]
    },
    {
        "mois": "aout",
        "soldeDebut": 1500.44,
        "soldeFin": 1596.44,
        "operations": [
            { "date": "04/08/2026", "label": "Épargne programmée", "type": "revenu", "cat": "mouvement interne créditeur", "montant": 200.00, "interne": true },
            { "date": "10/08/2026", "label": "Virement depuis compte commun", "type": "revenu", "cat": "mouvement interne créditeur", "montant": 35.00, "interne": true },
            { "date": "10/08/2026", "label": "Remboursement wakeboard", "type": "revenu", "cat": "Autre revenu", "montant": 88.00 },
            { "date": "10/08/2026", "label": "Remboursement lunettes", "type": "revenu", "cat": "Autre revenu", "montant": 48.00 },
            { "date": "10/08/2026", "label": "Remboursement lit", "type": "revenu", "cat": "Autre revenu", "montant": 125.00 },
            { "date": "20/08/2026", "label": "Virement vers compte commun", "type": "depense", "cat": "mouvement interne débiteur", "montant": 200.00, "interne": true },
            { "date": "25/08/2026", "label": "Virement vers compte commun", "type": "depense", "cat": "mouvement interne débiteur", "montant": 200.00, "interne": true }
        ]
    },
    {
        "mois": "septembre",
        "soldeDebut": 1596.44,
        "soldeFin": 867.44,
        "operations": [
            { "date": "04/09/2026", "label": "Épargne programmée", "type": "revenu", "cat": "mouvement interne créditeur", "montant": 200.00, "interne": true },
            { "date": "10/09/2026", "label": "Virement vers compte commun", "type": "depense", "cat": "mouvement interne débiteur", "montant": 260.00, "interne": true },
            { "date": "10/09/2026", "label": "Remboursement wakeboard", "type": "revenu", "cat": "Autre revenu", "montant": 88.00 },
            { "date": "10/09/2026", "label": "Remboursement lit", "type": "revenu", "cat": "Autre revenu", "montant": 125.00 },
            { "date": "14/09/2026", "label": "Virement depuis compte commun", "type": "revenu", "cat": "mouvement interne créditeur", "montant": 400.00, "interne": true },
            { "date": "14/09/2026", "label": "Virement vers compte commun", "type": "depense", "cat": "mouvement interne débiteur", "montant": 150.00, "interne": true },
            { "date": "15/09/2026", "label": "Virement vers compte commun", "type": "depense", "cat": "mouvement interne débiteur", "montant": 355.00, "interne": true },
            { "date": "25/09/2026", "label": "Colonie Orpheopolis", "type": "depense", "cat": "education et famille", "montant": 777.00 }
        ]
    },
    {
        "mois": "octobre",
        "soldeDebut": null,
        "soldeFin": null,
        "operations": []
    },
    {
        "mois": "novembre",
        "soldeDebut": null,
        "soldeFin": null,
        "operations": []
    },
    {
        "mois": "decembre",
        "soldeDebut": null,
        "soldeFin": null,
        "operations": []
    }
];
