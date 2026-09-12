import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import {
  faArrowLeft,
  faFileZipper,
  faLink,
  faLinkSlash,
  faMagnifyingGlass,
  faPen,
  faPlus,
  faRightFromBracket,
  faTrash,
  faUpload,
  faUser,
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
    library.addIcons(faPlus, faPen, faTrash, faLink, faLinkSlash, faMagnifyingGlass, faUser, faRightFromBracket, faArrowLeft, faUpload, faFileZipper);
  }
}
