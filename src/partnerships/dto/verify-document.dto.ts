import { IsIn } from 'class-validator';

export class VerifyDocumentDto {
  @IsIn(['idDocument', 'selfie', 'license', 'insurance'])
  document: 'idDocument' | 'selfie' | 'license' | 'insurance';

  @IsIn(['verified', 'rejected', 'pending'])
  status: 'verified' | 'rejected' | 'pending';
}
