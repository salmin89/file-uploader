import {
  Component,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import {
  combineLatest,
  fromEvent,
  Observable,
  Observer,
  of,
  Subscription,
  BehaviorSubject,
} from 'rxjs';
import {
  catchError,
  filter,
  map,
  switchMap,
  takeUntil,
  shareReplay,
} from 'rxjs/operators';

export type IVerifiedFile = Omit<IUploadedFile, 'error'>;

export interface IUploadedFile {
  file?: File;
  image?: Partial<HTMLImageElement>;
  error?: IUploadError;
}

export interface IUploadError {
  name: string;
  errorMessage: string;
}

@Component({
  selector: 'it-file-uploader',
  templateUrl: './file-uploader.component.html',
})
export class FileUploaderComponent {
  @Input() fileSizeLimit: number;
  @Input() multiple: boolean = true;
  @Input() accept: string;
  @Input() disabled: boolean = false;

  @Input() initialValues: IUploadedFile[];

  @Output() onFileChanges = new EventEmitter<IVerifiedFile[]>();

  @ViewChild('fileInput') fileInputRef;

  files$: Observable<IUploadedFile[]>;
  removed$ = new BehaviorSubject([]);

  constructor() {}

  subscription: Subscription;
  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  ngAfterViewInit() {
    const fileChanges$ = fromEvent(
      this.fileInputRef.nativeElement,
      'change'
    ).pipe(
      map((event: any) => event?.target?.files),
      filter((files: FileList) => files.length > 0),
      switchMap((files) => {
        const validatedFiles: Observable<IUploadedFile>[] = [];

        for (const file of Object.values(files)) {
          validatedFiles.push(
            this.validateFile(file).pipe(
              catchError((error: IUploadedFile) => of(error))
            )
          );
        }
        return combineLatest(validatedFiles);
      }),
      shareReplay()
    );

    this.files$ = combineLatest([fileChanges$, this.removed$]).pipe(
      map(([fileChanges, removedFiles]) => {
        return fileChanges.filter(
          (file) => !removedFiles.find((r) => r === file)
        );
      }),
      shareReplay()
    );

    // Filter out error values before emit
    this.subscription = this.files$
      .pipe(
        map((uploadedFiles: IUploadedFile[]) =>
          uploadedFiles.filter((files) => !files.error)
        )
      )
      .subscribe((result) => {
        this.onFileChanges.emit(result);
      });
  }

  private validateFile(file: File): Observable<IUploadedFile> {
    const fileReader = new FileReader();

    return new Observable((observer: Observer<IUploadedFile>) => {
      this.fileSizeLimit && this.validateSize(file, observer);

      fileReader.readAsDataURL(file);
      fileReader.onload = () => {
        this.validateFileType(file, fileReader, observer);
      };
      fileReader.onerror = () => {
        observer.error({
          error: {
            name: file.name,
            errorMessage: 'INVALID_FILE',
          },
        });
      };
    });
  }

  private isImage(mimeType: string): boolean {
    return mimeType.match(/image\/*/) !== null;
  }

  private validateFileType(
    file: File,
    fileReader: FileReader,
    observer: Observer<IUploadedFile>
  ): void {
    const { type, name } = file;
    if (this.isImage(type)) {
      const image = new Image();
      image.onload = () => {
        observer.next({ file, image });
        observer.complete();
      };
      image.onerror = () => {
        // image.onerror only triggers if the image is corrupt and won't load
        observer.error({ error: { name, errorMessage: 'INVALID_IMAGE' } });
      };
      image.src = fileReader.result as string;
    } else {
      // it's not an image
      observer.error({ error: { name, errorMessage: 'INVALID_IMAGE' } });
      observer.complete();
    }
  }

  private validateSize(file: File, observer: Observer<IUploadedFile>): void {
    const { name, size } = file;
    if (size > this.fileSizeLimit)
      observer.error({ error: { name, errorMessage: 'INVALID_SIZE' } });
  }

  public remove(file) {
    this.removed$.next([...this.removed$.value, file]);
  }

  public removeInitial(file) {
    this.initialValues = this.initialValues.filter((f) => file !== f);
    this.onFileChanges.emit(this.initialValues);
  }
}
