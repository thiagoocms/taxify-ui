import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import {
  faArrowLeft,
  faArrowRight,
  faChevronDown,
  faChevronUp,
  faCircleCheck,
  faCopy,
  faDownload,
  faEye,
  faFileCode,
  faFileInvoice,
  faFilePdf,
  faUpRightFromSquare,
  faFileZipper,
  faLocationDot,
  faLink,
  faLinkSlash,
  faMagnifyingGlass,
  faPen,
  faPlus,
  faRightFromBracket,
  faTrash,
  faUpload,
  faUser,
  faTriangleExclamation,
  faWandMagicSparkles,
  faLock,
  faLockOpen,
  faChevronLeft,
  faChevronRight,
  faCalculator,
  faCloudArrowDown,
} from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'taxify-front';

  constructor(library: FaIconLibrary) {
    library.addIcons(faLock, faLockOpen, faChevronLeft, faChevronRight, faCalculator, faPlus, faPen, faTrash, faLink, faLinkSlash, faMagnifyingGlass, faUser, faRightFromBracket, faArrowLeft, faUpload, faFileZipper, faCloudArrowDown);
    library.addIcons(
      faArrowRight, faChevronDown, faChevronUp, faCircleCheck, faCopy, faDownload, faEye, faFileCode,
      faFileInvoice, faFilePdf, faUpRightFromSquare, faLocationDot, faTriangleExclamation, faWandMagicSparkles,
    );
  }
}
