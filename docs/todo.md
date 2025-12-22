# SMS Padel Sync - Backlog & Todo

## 🎯 Next Immediate Tasks
- [ ] Move `backend/*.py` (tests/scripts) into `backend/scripts/` or `backend/tests/` <!-- id: 7 -->
- [ ] Implement automated court booking integration (Play-by-Point/Playtomic) <!-- id: 8 -->
- [ ] Add "Resend Invite" button to Admin Match Dashboard <!-- id: 9 -->
- [ ] Implement "Quiet Hours" enforcement for match invites in `matchmaker.py` <!-- id: 10 -->

## 🛠️ Technical Debt
- [ ] Standardize error handling across all SMS handlers <!-- id: 11 -->
- [ ] Refactor `sms_handler.py` to delegating more logic to sub-handlers <!-- id: 12 -->
- [ ] Add unit tests for `logic/reasoner.py` intents <!-- id: 13 -->
- [ ] Sync `backend/schema.sql` with migrations regularly <!-- id: 14 -->

## 🚀 Future Epics (Under Consideration)
- **Player Portal**: Web UI for players to manage profiles and availability.
- **Competitive Leagues**: Elo rankings and season management.
- **Club Dashboard v2**: Advanced analytics and churn prediction for club owners.
- **Multi-Club Scaling**: Automated provisioning for new club launches.
