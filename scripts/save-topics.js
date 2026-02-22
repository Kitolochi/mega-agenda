const fs = require('fs');
const path = require('path');
const dbPath = path.join(process.env.APPDATA || '', 'mega-agenda', 'mega-agenda.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
const goal = db.roadmapGoals.find(g => g.id === 'mlvbxouqzi1tpb');

goal.research_questions = [
  "What are the total estimated first-year costs of raising a baby, including healthcare, gear, childcare, formula/feeding, diapers, and daily essentials, and how should I adjust my household budget accordingly?",
  "What health insurance changes need to be made after birth, what is the qualifying life event window (typically 30-60 days), and how do I compare plans to ensure adequate pediatric and maternity/postpartum coverage?",
  "What are the differences between 529 education savings plans, Coverdell ESAs, custodial accounts (UGMA/UTMA), and Roth IRAs for college savings, and when should I start contributing?",
  "How much life insurance coverage do new parents need (the 5-10x income rule of thumb), and what are the trade-offs between term life and permanent/whole life policies for each parent?",
  "What should be included in a will and estate plan for new parents, including naming a legal guardian, setting up a trust for assets, and establishing power of attorney and healthcare directives?",
  "What is the CDC/AAP recommended vaccination schedule for the first year (Hep B at birth, DTaP, rotavirus, IPV, Hib, PCV, flu, etc.), and what are the documented benefits and possible side effects of each vaccine?",
  "What are the warning signs of postpartum depression versus normal baby blues, how does paternal postpartum depression present, and what treatment options are available for both parents?",
  "What are the AAP safe sleep guidelines for SIDS prevention, including back sleeping, firm flat mattress, room-sharing without bed-sharing, no loose bedding, and pacifier use?",
  "What are the major sleep training methods (Ferber/graduated extinction, cry-it-out/full extinction, chair method, pick-up-put-down, no-cry approaches) and at what age is each appropriate to begin?",
  "What criteria should I use to select a pediatrician, including board certification, hospital affiliations, office hours, after-hours availability, vaccination philosophy, and communication style?",
  "What are my legal rights under FMLA (12 weeks unpaid for employers with 50+ employees), state-specific paid family leave laws, and my employer parental leave policy, and how do I maximize my total leave time?",
  "What does the PUMP Act require employers to provide for breastfeeding parents (private non-bathroom space, reasonable break time for up to one year), and what are my state-specific protections?",
  "What is the realistic cost comparison between daycare centers ($800-$1,500/month), in-home family care, hiring a nanny ($1,500-$4,300/month), and au pair programs, including tax implications of being a household employer?",
  "How early should I get on daycare waitlists (experts recommend first trimester for infant care), what questions should I ask when touring facilities, and what licensing and accreditation standards should I verify?",
  "What are the key differences between parenting philosophies such as attachment parenting, RIE, Montessori, positive discipline, and authoritative parenting, and how do they affect child development outcomes?",
  "What developmental milestones should I expect in the first 12 months (social smiling, rolling, sitting, crawling, first words), and what are the evidence-based red flags that warrant early intervention?",
  "What are the federal and state tax benefits available to new parents, including the Child Tax Credit, Child and Dependent Care Tax Credit, FSA/Dependent Care FSA, and filing status changes?",
  "What legal and administrative steps must be completed after birth, including obtaining a birth certificate, applying for a Social Security number, adding the baby to health insurance within the qualifying window, and updating beneficiaries on all financial accounts?",
  "What is the evidence on breastfeeding vs. formula feeding regarding nutrition, immune benefits, bonding, and practical considerations, and what combination/supplementation approaches exist?",
  "How do I evaluate whether to negotiate a phased return to work, reduced schedule, or remote work arrangement after parental leave, and what strategies improve the chances of employer approval?"
];

goal.guidance_needed = [
  "Step-by-step guidance on creating a birth plan that covers labor preferences, pain management options (epidural, nitrous oxide, unmedicated), delivery positions, who will be in the room, delayed cord clamping, skin-to-skin contact, and contingency plans for C-section",
  "A practical nursery setup plan including safe crib configuration (firm mattress, fitted sheet only, no bumpers/blankets/toys), room temperature (68-72F), white noise considerations, blackout curtains, and a functional changing station layout",
  "A complete baby gear buying guide that distinguishes true essentials (car seat, crib, diapers, onesies, swaddles, bottles) from overhyped products (wipe warmers, bottle warmers, excessive newborn-size clothing, baby shoes), with a realistic budget for each category",
  "Detailed guidance on proper car seat selection, installation (rear-facing only for infants), harness adjustment, and how to get a free car seat inspection at a local fire station or certified inspection station",
  "A practical newborn care skills checklist covering diapering technique, umbilical cord stump care, safe bathing (sponge bath until cord falls off then tub bath), swaddling, soothing techniques (the 5 Ss: swaddle, side/stomach position, shush, swing, suck), and recognizing hunger/tiredness cues",
  "How to build a postpartum support plan including meal prep and freezer meals before birth, creating a visitor policy with clear boundaries and health requirements, dividing night feeding duties between partners, and identifying local postpartum support groups and lactation consultants",
  "A home baby-proofing guide organized by priority and timeline: immediate needs before arrival (smoke/CO detectors, safe sleep space, pet adjustment), 0-6 month needs (secure furniture to walls, cover outlets), and 6-12 month crawling/walking prep (cabinet locks, stair gates, cord management, toilet locks)",
  "Guidance on how to set up and manage the financial and legal framework for a new baby: opening a 529 plan, purchasing term life insurance for both parents, drafting a will with guardian designation, building a 3-6 month emergency fund, and creating a monthly baby expense budget",
  "A feeding preparation guide covering breastfeeding basics (latching technique, positioning, cluster feeding expectations, when to seek a lactation consultant), bottle-feeding setup (types of bottles, formula selection with pediatrician guidance, paced bottle feeding), and pumping logistics (pump selection, storage guidelines, building a freezer stash)",
  "How to take infant/child CPR and first aid training (American Heart Association or Red Cross classes), assemble a baby-specific first aid kit, and create a quick-reference emergency card with pediatrician number, poison control (1-800-222-1222), nearest ER, and list of symptoms that require immediate medical attention",
  "A communication and relationship preservation plan for new parents: how to discuss and align on parenting roles and expectations before birth, strategies for managing sleep deprivation as a team, scheduling regular check-ins with your partner, recognizing when professional couples counseling would help, and maintaining individual identity and self-care routines",
  "Practical guidance on preparing for the hospital stay: what to pack in the hospital bag for birthing parent (ID, insurance card, birth plan, comfortable clothes, toiletries, phone charger, going-home outfit for baby), what to pack for the support partner, pre-registering at the hospital, understanding typical hospital stay duration (1-2 days vaginal, 3-4 days C-section), and knowing what the hospital provides vs. what to bring",
  "How to systematically evaluate and select childcare: creating a list of must-have criteria, questions to ask daycare directors and nanny candidates, checking references and background checks, understanding state licensing requirements, evaluating caregiver-to-child ratios, and planning for backup childcare when the primary arrangement falls through"
];

if (!goal.topicReports) goal.topicReports = [];
goal.updatedAt = new Date().toISOString();

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');
console.log('Saved ' + goal.research_questions.length + ' research questions and ' + goal.guidance_needed.length + ' guidance needs to goal: ' + goal.title);
