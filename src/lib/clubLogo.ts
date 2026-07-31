import {Alert} from 'react-native';
import {pickLogoImage} from './media';
import {getClubForTeamSpace, setClubLogo} from './api/teams';

/**
 * Valgfritt «Legg til klubblogoen?»-steg etter at et lag med NY klubb er
 * opprettet (P4). Kalles fra executeCreate, så begge veiene dekkes —
 * direkteveien og auth-before-commit-resumet. Klubben må finnes først
 * (path/RPC trenger club_id), derfor ETTER opprettelsen — og med en liten
 * forsinkelse så navigasjonsbyttet til appen får lande før alerten.
 */
export function offerClubLogoAfterCreate(
  teamSpaceId: string,
  clubName: string,
  refresh: () => Promise<void>,
) {
  setTimeout(() => {
    Alert.alert(
      'Legg til klubblogoen?',
      `Logoen vises på lagmerket og når andre finner «${clubName}» i klubbsøket. Du kan også gjøre det senere under Laginnstillinger.`,
      [
        {text: 'Senere', style: 'cancel'},
        {text: 'Velg bilde', onPress: () => addClubLogo(teamSpaceId, refresh)},
      ],
      {cancelable: true},
    );
  }, 800);
}

async function addClubLogo(teamSpaceId: string, refresh: () => Promise<void>) {
  const image = await pickLogoImage();
  if (!image) return;
  try {
    const club = await getClubForTeamSpace(teamSpaceId);
    if (!club) {
      throw new Error('Fant ikke klubben.');
    }
    // Write-once: rakk noen andre å sette logoen, er jobben alt gjort.
    if (club.logoUrl) return;
    await setClubLogo(club.id, image);
    await refresh();
  } catch (e: any) {
    Alert.alert(
      'Kunne ikke lagre logoen',
      e?.message ?? 'Du kan prøve igjen under Laginnstillinger.',
    );
  }
}
