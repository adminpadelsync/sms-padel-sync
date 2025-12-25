import { Suspense } from 'react';
import { getUserClub } from '../get-user-club';
import { RankingsClient } from './rankings-client';

export default async function RankingsPage() {
    const userClub = await getUserClub();
    const clubId = userClub?.club_id || null;

    return (
        <Suspense fallback={<div className="p-12 text-center">Loading rankings...</div>}>
            <RankingsClient initialClubId={clubId} />
        </Suspense>
    );
}
